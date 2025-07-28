// script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Referensi Elemen DOM Global ---
    const navLinks = document.querySelectorAll('nav ul li a');
    const sections = document.querySelectorAll('main section');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const logoutBtn = document.getElementById('logoutBtn'); // Dapatkan tombol logout
    const body = document.body;

    // --- Ambil Referensi Firebase dari window ---
    // Pastikan ini diinisialisasi di index.html dalam script type="module"
    const {
        auth, db, storage,
        createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged,
        doc, collection, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
        query, where, orderBy, limit, onSnapshot,
        ref, uploadBytesResumable, getDownloadURL, deleteObject
    } = window.firebase;

    let currentUser = null; // Menyimpan objek pengguna yang sedang login
    let currentUserProfile = null; // Menyimpan data profil lengkap pengguna yang sedang login

    // --- Fungsi Bantuan UI ---
    const showSection = (id) => {
        sections.forEach(section => {
            if (section.id === id) {
                section.style.display = 'block';
                section.classList.add('active-section');
            } else {
                section.style.display = 'none';
                section.classList.remove('active-section');
            }
        });

        // Set active class untuk link navigasi
        navLinks.forEach(link => {
            if (link.getAttribute('href') === `#${id.replace('-section', '')}`) {
                link.classList.add('active-link');
            } else {
                link.classList.remove('active-link');
            }
        });
    };

    const showAlert = (message, type = 'info') => {
        // Implementasi alert yang lebih baik (misalnya, modal kustom, toast notification)
        alert(`${type.toUpperCase()}: ${message}`);
    };

    // --- Navigasi dan Mode Gelap ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = e.target.getAttribute('href').substring(1);

            if (targetId === 'darkModeToggle') {
                return; // Jangan navigasi, ini ditangani oleh event listener terpisah
            }

            // Arahkan ke auth-section jika belum login dan bukan ke halaman auth
            if (!currentUser && targetId !== 'auth') {
                showAlert('Anda harus login terlebih dahulu!', 'warning');
                showSection('auth-section');
                return;
            }
            // Khusus untuk logout
            if (targetId === 'logout') {
                handleLogout();
                return;
            }

            showSection(targetId + '-section');
        });
    });

    // Fungsionalitas Mode Gelap
    if (localStorage.getItem('darkMode') === 'enabled') {
        body.classList.add('dark-mode');
        darkModeToggle.textContent = 'Mode Terang';
    } else {
        darkModeToggle.textContent = 'Mode Gelap';
    }

    darkModeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        if (body.classList.contains('dark-mode')) {
            localStorage.setItem('darkMode', 'enabled');
            darkModeToggle.textContent = 'Mode Terang';
        } else {
            localStorage.setItem('darkMode', 'disabled');
            darkModeToggle.textContent = 'Mode Gelap';
        }
    });

    // --- Firebase Authentication ---

    // Login Form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.querySelector('input[type="email"]').value;
            const password = loginForm.querySelector('input[type="password"]').value;

            try {
                await signInWithEmailAndPassword(auth, email, password);
                // Status login akan ditangani oleh onAuthStateChanged
                showAlert('Login berhasil! Selamat datang di GloVish.', 'success');
                loginForm.reset();
            } catch (error) {
                console.error('Login gagal:', error);
                let displayMessage = 'Login gagal. Silakan coba lagi.';
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    displayMessage = 'Email atau password salah.';
                } else if (error.code === 'auth/invalid-email') {
                    displayMessage = 'Format email tidak valid.';
                }
                showAlert(displayMessage, 'error');
            }
        });
    }

    // Register Form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = registerForm.querySelector('input[type="text"]').value.trim();
            const email = registerForm.querySelector('input[type="email"]').value.trim();
            const password = registerForm.querySelector('input[type="password"]').value;

            if (!username) {
                showAlert('Username tidak boleh kosong.', 'warning');
                return;
            }

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Simpan username dan data awal ke Firestore sebagai profil pengguna
                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    username: username,
                    email: user.email,
                    profilePic: 'https://via.placeholder.com/100/CCCCCC/FFFFFF?text=GL', // Default profile pic
                    followers: [],
                    following: []
                });

                showAlert('Registrasi berhasil! Sekarang Anda bisa login.', 'success');
                registerForm.reset();
                showSection('auth-section'); // Kembali ke halaman login
            } catch (error) {
                console.error('Registrasi gagal:', error);
                let displayMessage = 'Registrasi gagal. Silakan coba lagi.';
                if (error.code === 'auth/email-already-in-use') {
                    displayMessage = 'Email ini sudah terdaftar. Silakan gunakan email lain atau login.';
                } else if (error.code === 'auth/weak-password') {
                    displayMessage = 'Password terlalu lemah (minimal 6 karakter).';
                } else if (error.code === 'auth/invalid-email') {
                    displayMessage = 'Format email tidak valid.';
                }
                showAlert(displayMessage, 'error');
            }
        });
    }

    // Lupa Password
    const forgotPasswordLink = document.getElementById('forgotPassword');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = prompt('Masukkan email Anda untuk reset password:');
            if (email) {
                try {
                    await sendPasswordResetEmail(auth, email.trim());
                    showAlert('Link reset password telah dikirim ke email Anda. Silakan cek kotak masuk Anda.', 'info');
                } catch (error) {
                    console.error('Reset password gagal:', error);
                    let displayMessage = 'Gagal mengirim link reset password.';
                    if (error.code === 'auth/user-not-found') {
                        displayMessage = 'Email tidak terdaftar.';
                    } else if (error.code === 'auth/invalid-email') {
                        displayMessage = 'Format email tidak valid.';
                    }
                    showAlert(displayMessage, 'error');
                }
            }
        });
    }

    // Logout
    const handleLogout = async () => {
        try {
            await signOut(auth);
            showAlert('Anda telah berhasil logout.', 'info');
            // onAuthStateChanged akan menangani pengalihan ke halaman auth-section
            // dan membersihkan UI
        } catch (error) {
            console.error('Gagal logout:', error);
            showAlert('Gagal logout. Silakan coba lagi.', 'error');
        }
    };
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Memantau status autentikasi (untuk tetap login saat refresh dan inisialisasi awal)
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log('Pengguna sudah login:', user.email, user.uid);

            // Dapatkan data profil lengkap pengguna dari Firestore
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                currentUserProfile = userDocSnap.data();
            } else {
                console.warn("User profile not found in Firestore for logged in user!");
                // Ini bisa terjadi jika ada user di Auth tapi dokumen profilnya belum dibuat
                // Mungkin perlu force logout atau membuat dokumen profil default
                showAlert('Profil pengguna tidak ditemukan. Silakan coba daftar ulang atau hubungi dukungan.', 'error');
                await signOut(auth); // Force logout
                return;
            }

            // Muat data untuk halaman yang relevan
            fetchAndDisplayUserProfile(currentUser.uid); // Selalu perbarui profil di UI
            fetchFeedPosts(); // Muat postingan feed
            // setupChatListener(); // Siapkan listener chat (jika ada chat yang sedang dibuka)
            showSection('feed-section'); // Default setelah login

        } else {
            currentUser = null;
            currentUserProfile = null;
            console.log('Pengguna belum login.');
            showSection('auth-section');
            // Bersihkan UI terkait pengguna jika logout
            document.getElementById('profileUsername').textContent = 'NamaPenggunaSaya';
            document.getElementById('profilePicDisplay').src = 'https://via.placeholder.com/100';
            document.getElementById('followerCount').textContent = '0';
            document.getElementById('followingCount').textContent = '0';
            const userPostsContainer = document.querySelector('#profile-section .user-posts');
            if(userPostsContainer) userPostsContainer.innerHTML = '<h3>Postingan Saya</h3><p class="loading-message">Silakan login untuk melihat postingan Anda.</p>';
            const feedContainer = document.querySelector('#feed-section .post-container');
            if(feedContainer) feedContainer.innerHTML = '<p class="loading-message">Silakan login untuk melihat feed.</p>';
            // Hentikan semua listener real-time jika ada
            if (unsubscribeChatListener) unsubscribeChatListener();
        }
    });

    // --- Firestore Operations (Profil Pengguna) ---

    // Dapatkan & Tampilkan Profil Pengguna
    const fetchAndDisplayUserProfile = async (uid) => {
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                document.getElementById('profileUsername').textContent = userData.username || 'Tidak ada nama';
                document.getElementById('profilePicDisplay').src = userData.profilePic || 'https://via.placeholder.com/100/CCCCCC/FFFFFF?text=GL';
                document.getElementById('followerCount').textContent = userData.followers ? userData.followers.length : 0;
                document.getElementById('followingCount').textContent = userData.following ? userData.following.length : 0;

                // Set input username untuk edit
                const editUsernameInput = document.getElementById('editUsernameInput');
                if (editUsernameInput) {
                    editUsernameInput.value = userData.username || '';
                }
            } else {
                console.log("No such user document!");
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
        }
    };

    // Edit Profil
    const editUsernameBtn = document.getElementById('editUsernameBtn');
    const profileUsernameSpan = document.getElementById('profileUsername');
    const editUsernameInput = document.getElementById('editUsernameInput');
    const profilePicUpload = document.getElementById('profilePicUpload');
    const profilePicDisplay = document.getElementById('profilePicDisplay');

    if (editUsernameBtn && profileUsernameSpan && editUsernameInput) {
        editUsernameBtn.addEventListener('click', async () => {
            if (!currentUser) {
                showAlert('Anda harus login untuk mengedit profil.', 'warning');
                return;
            }
            if (editUsernameInput.style.display === 'none') {
                profileUsernameSpan.style.display = 'none';
                editUsernameInput.style.display = 'inline-block';
                editUsernameInput.focus();
                editUsernameBtn.textContent = 'Simpan';
            } else {
                const newUsername = editUsernameInput.value.trim();
                if (newUsername && newUsername !== profileUsernameSpan.textContent) {
                    try {
                        await updateDoc(doc(db, "users", currentUser.uid), {
                            username: newUsername
                        });
                        profileUsernameSpan.textContent = newUsername;
                        currentUserProfile.username = newUsername; // Perbarui di variabel lokal juga
                        showAlert('Username berhasil diperbarui!', 'success');
                    } catch (error) {
                        console.error("Error updating username:", error);
                        showAlert('Gagal memperbarui username.', 'error');
                    }
                }
                profileUsernameSpan.style.display = 'inline-block';
                editUsernameInput.style.display = 'none';
                editUsernameBtn.textContent = 'Edit Username';
            }
        });

        editUsernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                editUsernameBtn.click();
            }
        });
    }

    // Ganti Foto Profil
    if (profilePicUpload && profilePicDisplay) {
        profilePicUpload.addEventListener('change', async (e) => {
            if (!currentUser) {
                showAlert('Anda harus login untuk mengganti foto profil.', 'warning');
                return;
            }
            const file = e.target.files[0];
            if (!file) return;

            showAlert('Mengunggah foto profil...', 'info');
            const storagePath = `profilePics/${currentUser.uid}/${file.name}`;
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log('Upload foto profil: ' + progress.toFixed(2) + '% done');
                },
                (error) => {
                    console.error("Upload profile pic failed:", error);
                    showAlert('Gagal mengunggah foto profil.', 'error');
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    try {
                        await updateDoc(doc(db, "users", currentUser.uid), {
                            profilePic: downloadURL
                        });
                        profilePicDisplay.src = downloadURL;
                        currentUserProfile.profilePic = downloadURL; // Perbarui di variabel lokal
                        showAlert('Foto profil berhasil diperbarui!', 'success');
                    } catch (error) {
                        console.error("Error updating profile pic URL in Firestore:", error);
                        showAlert('Gagal menyimpan URL foto profil.', 'error');
                    }
                }
            );
        });
    }

    // Follow/Unfollow
    const toggleFollow = async (targetUserId) => {
        if (!currentUser) {
            showAlert('Anda harus login untuk mengikuti pengguna.', 'warning');
            return;
        }
        if (currentUser.uid === targetUserId) {
            showAlert('Anda tidak bisa mengikuti diri sendiri.', 'info');
            return;
        }

        const currentUserRef = doc(db, "users", currentUser.uid);
        const targetUserRef = doc(db, "users", targetUserId);

        try {
            const currentUserDoc = await getDoc(currentUserRef);
            const targetUserDoc = await getDoc(targetUserRef);

            if (!currentUserDoc.exists() || !targetUserDoc.exists()) {
                showAlert('Pengguna tidak ditemukan.', 'error');
                return;
            }

            const currentUserData = currentUserDoc.data();
            const targetUserData = targetUserDoc.data();

            let currentUserFollowing = currentUserData.following || [];
            let targetUserFollowers = targetUserData.followers || [];

            const isFollowing = currentUserFollowing.includes(targetUserId);

            if (isFollowing) {
                // Unfollow
                currentUserFollowing = currentUserFollowing.filter(id => id !== targetUserId);
                targetUserFollowers = targetUserFollowers.filter(id => id !== currentUser.uid);
                await updateDoc(currentUserRef, { following: currentUserFollowing });
                await updateDoc(targetUserRef, { followers: targetUserFollowers });
                showAlert('Berhasil berhenti mengikuti!', 'info');
            } else {
                // Follow
                currentUserFollowing.push(targetUserId);
                targetUserFollowers.push(currentUser.uid);
                await updateDoc(currentUserRef, { following: currentUserFollowing });
                await updateDoc(targetUserRef, { followers: targetUserFollowers });
                showAlert('Berhasil mengikuti!', 'success');
            }
            // Perbarui jumlah follower/following di profil jika itu profil saya
            if (currentUserProfile) { // Pastikan currentUserProfile sudah terisi
                currentUserProfile.following = currentUserFollowing; // Perbarui lokal
                fetchAndDisplayUserProfile(currentUser.uid); // Perbarui tampilan UI
            }
            // Perbarui juga tampilan tombol follow di feed/chat yang mungkin ada
        } catch (error) {
            console.error("Error toggling follow:", error);
            showAlert('Gagal mengikuti/berhenti mengikuti.', 'error');
        }
    };
    window.toggleFollow = toggleFollow; // Membuatnya dapat diakses dari event listener dinamis

    // --- Upload Konten (Foto/Video) ---
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) {
                showAlert('Anda harus login untuk mengunggah konten.', 'warning');
                return;
            }

            const fileInput = uploadForm.querySelector('input[type="file"]');
            const title = uploadForm.querySelector('input[type="text"]').value.trim();
            const description = uploadForm.querySelector('textarea').value.trim();
            const file = fileInput.files[0];

            if (!file || !title) {
                showAlert('Harap pilih file dan masukkan judul.', 'warning');
                return;
            }

            showAlert('Memulai pengunggahan...', 'info');

            const fileType = file.type.startsWith('image/') ? 'image' : 'video';
            const storagePath = `${fileType}s/${currentUser.uid}/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log('Upload: ' + progress.toFixed(2) + '% done');
                    showAlert(`Mengunggah: ${progress.toFixed(0)}%`, 'info');
                },
                (error) => {
                    console.error("Upload failed:", error);
                    showAlert('Gagal mengunggah file.', 'error');
                },
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                        // Gunakan currentUserProfile.username yang sudah diambil saat login
                        await addDoc(collection(db, "posts"), {
                            userId: currentUser.uid,
                            username: currentUserProfile ? currentUserProfile.username : 'Unknown User',
                            profilePic: currentUserProfile ? currentUserProfile.profilePic : 'https://via.placeholder.com/40',
                            mediaURL: downloadURL,
                            mediaType: fileType,
                            title: title,
                            description: description,
                            timestamp: new Date(),
                            likes: [],
                            dislikes: [],
                            comments: []
                        });
                        showAlert('Unggahan berhasil!', 'success');
                        uploadForm.reset();
                        showSection('feed-section'); // Arahkan kembali ke feed
                    } catch (error) {
                        console.error("Error saving post data to Firestore:", error);
                        showAlert('Gagal menyimpan data postingan.', 'error');
                    }
                }
            );
        });
    }

    // --- Feed (Menampilkan Postingan) ---
    const feedContainer = document.querySelector('#feed-section .post-container');

    const fetchFeedPosts = () => {
        if (!feedContainer || !currentUser) return;

        feedContainer.innerHTML = '<p class="loading-message">Memuat postingan...</p>';
        const q = query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(20)); // Ambil 20 postingan terbaru

        onSnapshot(q, (snapshot) => {
            feedContainer.innerHTML = ''; // Kosongkan feed sebelum mengisi ulang
            if (snapshot.empty) {
                feedContainer.innerHTML = '<p class="info-message">Belum ada postingan. Jadilah yang pertama!</p>';
                return;
            }

            snapshot.forEach((doc) => {
                const post = doc.data();
                const postId = doc.id;

                // Pastikan post.likes dan post.dislikes adalah array
                post.likes = Array.isArray(post.likes) ? post.likes : [];
                post.dislikes = Array.isArray(post.dislikes) ? post.dislikes : [];

                const isLiked = currentUser && post.likes.includes(currentUser.uid);
                const isDisliked = currentUser && post.dislikes.includes(currentUser.uid);

                // Tentukan status follow untuk tombol Ikuti
                let followBtnText = 'Ikuti';
                let followBtnStyle = '';
                if (currentUser && currentUser.uid === post.userId) {
                    followBtnStyle = 'display:none;'; // Sembunyikan tombol jika ini postingan saya
                } else if (currentUserProfile && currentUserProfile.following && currentUserProfile.following.includes(post.userId)) {
                    followBtnText = 'Berhenti Ikuti';
                }

                const postElement = document.createElement('div');
                postElement.classList.add('post');

                postElement.innerHTML = `
                    <div class="post-header">
                        <img src="${post.profilePic || 'https://via.placeholder.com/40'}" alt="User Avatar" class="avatar">
                        <span class="username">${post.username}</span>
                    </div>
                    ${post.mediaType === 'image' ?
                        `<img src="${post.mediaURL}" alt="${post.title}" class="post-media">` :
                        `<video controls src="${post.mediaURL}" class="post-media"></video>`
                    }
                    <div class="post-actions">
                        <button class="like-btn ${isLiked ? 'active' : ''}" data-post-id="${postId}" data-action="like">👍 Up (${post.likes.length})</button>
                        <button class="dislike-btn ${isDisliked ? 'active' : ''}" data-post-id="${postId}" data-action="dislike">👎 Down (${post.dislikes.length})</button>
                        <button class="comment-btn" data-post-id="${postId}">💬 Komen</button>
                        <button class="follow-btn" data-user-id="${post.userId}" style="${followBtnStyle}">${followBtnText}</button>
                    </div>
                    <p class="post-caption"><strong>${post.title}</strong><br>${post.description}</p>
                    <div class="comments-section" data-post-id="${postId}">
                        <div class="comment-list"></div>
                        <input type="text" placeholder="Tambahkan komentar..." class="comment-input">
                        <button class="send-comment-btn">Kirim</button>
                    </div>
                `;
                feedContainer.prepend(postElement); // Tambahkan post terbaru di atas

                // Tambahkan event listener untuk tombol Like/Dislike
                postElement.querySelector('.like-btn').addEventListener('click', (e) => handleLikeDislike(e.target.dataset.postId, 'like'));
                postElement.querySelector('.dislike-btn').addEventListener('click', (e) => handleLikeDislike(e.target.dataset.postId, 'dislike'));

                // Tambahkan event listener untuk tombol Follow (jika ada)
                const followBtn = postElement.querySelector('.follow-btn');
                if (followBtn && followBtn.style.display !== 'none') { // Hanya tambahkan jika tombol tidak disembunyikan
                    followBtn.addEventListener('click', () => toggleFollow(followBtn.dataset.userId));
                }

                // Event listener untuk komentar
                const commentInput = postElement.querySelector('.comment-input');
                const sendCommentBtn = postElement.querySelector('.send-comment-btn');
                const commentList = postElement.querySelector('.comments-section .comment-list');

                if (sendCommentBtn && commentInput) {
                    sendCommentBtn.addEventListener('click', () => addComment(postId, commentInput.value));
                    commentInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') addComment(postId, commentInput.value);
                    });
                }

                // Muat komentar untuk postingan ini (real-time juga)
                loadComments(postId, commentList);
            });
        }, (error) => {
            console.error("Error fetching feed posts:", error);
            showAlert('Gagal memuat feed.', 'error');
            feedContainer.innerHTML = '<p class="info-message">Gagal memuat feed. Silakan coba lagi nanti.</p>';
        });
    };

    // Fungsi Like/Dislike
    const handleLikeDislike = async (postId, action) => {
        if (!currentUser) {
            showAlert('Anda harus login untuk memberi reaksi.', 'warning');
            return;
        }

        const postRef = doc(db, "posts", postId);
        try {
            const postDoc = await getDoc(postRef);
            if (!postDoc.exists()) return;

            const postData = postDoc.data();
            let likes = Array.isArray(postData.likes) ? postData.likes : [];
            let dislikes = Array.isArray(postData.dislikes) ? postData.dislikes : [];

            if (action === 'like') {
                if (likes.includes(currentUser.uid)) {
                    // Batalkan like
                    likes = likes.filter(uid => uid !== currentUser.uid);
                } else {
                    // Like
                    likes.push(currentUser.uid);
                    // Hapus dari dislike jika sebelumnya didislike
                    dislikes = dislikes.filter(uid => uid !== currentUser.uid);
                }
            } else if (action === 'dislike') {
                if (dislikes.includes(currentUser.uid)) {
                    // Batalkan dislike
                    dislikes = dislikes.filter(uid => uid !== currentUser.uid);
                } else {
                    // Dislike
                    dislikes.push(currentUser.uid);
                    // Hapus dari like jika sebelumnya dilike
                    likes = likes.filter(uid => uid !== currentUser.uid);
                }
            }
            await updateDoc(postRef, { likes: likes, dislikes: dislikes });
        } catch (error) {
            console.error("Error handling like/dislike:", error);
            showAlert('Gagal memberi reaksi.', 'error');
        }
    };

    // Fungsi Tambah Komentar
    const addComment = async (postId, commentText) => {
        if (!currentUser || !commentText.trim()) {
            showAlert('Anda harus login dan menulis komentar.', 'warning');
            return;
        }
        try {
            await addDoc(collection(db, "posts", postId, "comments"), {
                userId: currentUser.uid,
                username: currentUserProfile ? currentUserProfile.username : 'Unknown User',
                timestamp: new Date(),
                text: commentText.trim()
            });
            showAlert('Komentar berhasil ditambahkan!', 'success');
            // Bersihkan input setelah komentar berhasil
            document.querySelector(`.comments-section[data-post-id="${postId}"] .comment-input`).value = '';
        } catch (error) {
            console.error("Error adding comment:", error);
            showAlert('Gagal menambahkan komentar.', 'error');
        }
    };

    // Fungsi Muat Komentar (Real-time)
    const loadComments = (postId, commentListElement) => {
        if (!commentListElement) return;

        const q = query(collection(db, "posts", postId, "comments"), orderBy("timestamp", "asc"));
        onSnapshot(q, async (snapshot) => {
            commentListElement.innerHTML = ''; // Kosongkan dulu
            if (snapshot.empty) {
                commentListElement.innerHTML = '<p class="info-message" style="font-size:0.8em; text-align:left;">Belum ada komentar.</p>';
                return;
            }
            for (const commentDoc of snapshot.docs) {
                const comment = commentDoc.data();
                // Username sudah ada di data komentar, tidak perlu query user lagi
                const commentElement = document.createElement('p');
                commentElement.innerHTML = `<strong>${comment.username || 'Pengguna'}:</strong> ${comment.text}`;
                commentListElement.appendChild(commentElement);
            }
            commentListElement.scrollTop = commentListElement.scrollHeight; // Scroll to bottom
        }, (error) => {
            console.error("Error getting comments:", error);
            commentListElement.innerHTML = '<p class="info-message" style="font-size:0.8em; text-align:left;">Gagal memuat komentar.</p>';
        });
    };

    // --- Chat Pribadi ---
    const searchUserChatInput = document.getElementById('searchUserChat');
    const userListForChat = document.querySelector('#chat-section .user-list');
    const chatWindow = document.querySelector('#chat-section .chat-window');
    const currentChatUserSpan = document.getElementById('currentChatUser');
    const messagesContainer = document.querySelector('.chat-window .messages');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');

    let currentChatRecipientId = null;
    let unsubscribeChatListener = null; // Untuk menghentikan listener chat sebelumnya

    // Mencari pengguna
    if (searchUserChatInput) {
        searchUserChatInput.addEventListener('input', async (e) => {
            if (!currentUser) {
                showAlert('Anda harus login untuk mencari pengguna.', 'warning');
                return;
            }
            const searchTerm = e.target.value.toLowerCase().trim();
            userListForChat.innerHTML = ''; // Bersihkan daftar

            if (searchTerm.length < 1) { // Minimal 1 karakter untuk pencarian
                userListForChat.innerHTML = '<p class="info-message">Ketik untuk mencari pengguna...</p>';
                return;
            }

            try {
                // Query Firestore untuk username yang diawali dengan searchTerm
                const q = query(collection(db, "users"),
                                where("username", ">=", searchTerm),
                                where("username", "<=", searchTerm + '\uf8ff'),
                                limit(10)); // Batasi hasil
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    userListForChat.innerHTML = '<p class="info-message">Tidak ada pengguna ditemukan.</p>';
                    return;
                }

                querySnapshot.forEach((doc) => {
                    const userData = doc.data();
                    if (userData.uid !== currentUser.uid) { // Jangan tampilkan diri sendiri
                        const userElement = document.createElement('div');
                        userElement.classList.add('chat-user');

                        // Periksa apakah sudah diikuti
                        const isFollowingUser = currentUserProfile && currentUserProfile.following && currentUserProfile.following.includes(userData.uid);
                        const followBtnHtml = `<button class="follow-btn" data-user-id="${userData.uid}">${isFollowingUser ? 'Berhenti Ikuti' : 'Ikuti'}</button>`;

                        userElement.innerHTML = `
                            <img src="${userData.profilePic || 'https://via.placeholder.com/30'}" alt="User Avatar" class="avatar">
                            <span>${userData.username}</span>
                            ${followBtnHtml}
                            <button class="start-chat-btn" data-user-id="${userData.uid}" data-username="${userData.username}">Chat</button>
                        `;
                        userListForChat.appendChild(userElement);

                        userElement.querySelector('.start-chat-btn').addEventListener('click', (e) => {
                            startChat(e.target.dataset.userId, e.target.dataset.username);
                        });
                        userElement.querySelector('.follow-btn').addEventListener('click', (e) => {
                            toggleFollow(e.target.dataset.userId);
                            // Perbarui teks tombol follow setelah aksi
                            e.target.textContent = e.target.textContent === 'Ikuti' ? 'Berhenti Ikuti' : 'Ikuti';
                        });
                    }
                });
            } catch (error) {
                console.error("Error searching users:", error);
                userListForChat.innerHTML = '<p class="info-message">Gagal mencari pengguna.</p>';
            }
        });
    }

    // Memulai Chat
    const startChat = async (recipientId, recipientUsername) => {
        if (!currentUser) {
            showAlert('Anda harus login untuk chat.', 'warning');
            return;
        }
        currentChatRecipientId = recipientId;
        currentChatUserSpan.textContent = recipientUsername;
        chatWindow.style.display = 'flex'; // Gunakan flex untuk layout chat
        messagesContainer.innerHTML = '<p class="info-message">Memuat pesan...</p>'; // Tampilkan loading pesan

        // Hentikan listener chat sebelumnya jika ada
        if (unsubscribeChatListener) {
            unsubscribeChatListener();
        }

        // Buat ID percakapan yang konsisten (ID pengguna diurutkan)
        const chatRoomId = [currentUser.uid, recipientId].sort().join('_');
        const messagesRef = collection(db, "chats", chatRoomId, "messages");
        const q = query(messagesRef, orderBy("timestamp", "asc"));

        unsubscribeChatListener = onSnapshot(q, (snapshot) => {
            messagesContainer.innerHTML = ''; // Kosongkan untuk pesan baru
            if (snapshot.empty) {
                messagesContainer.innerHTML = '<p class="info-message">Mulai percakapan dengan mengirim pesan pertama!</p>';
                return;
            }
            snapshot.forEach(doc => {
                const msg = doc.data();
                const msgElement = document.createElement('div');
                msgElement.classList.add('chat-message');
                msgElement.classList.add(msg.senderId === currentUser.uid ? 'sent' : 'received');
                msgElement.textContent = msg.text;
                messagesContainer.appendChild(msgElement);
            });
            messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll ke bawah
        }, (error) => {
            console.error("Error getting chat messages:", error);
            showAlert('Gagal memuat pesan chat.', 'error');
            messagesContainer.innerHTML = '<p class="info-message">Gagal memuat pesan chat.</p>';
        });
    };

    // Mengirim Pesan
    if (sendMessageBtn && messageInput) {
        sendMessageBtn.addEventListener('click', async () => {
            await sendMessage();
        });
        messageInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                await sendMessage();
            }
        });
    }

    const sendMessage = async () => {
        if (!currentUser || !currentChatRecipientId) {
            showAlert('Pilih pengguna untuk chat terlebih dahulu.', 'warning');
            return;
        }
        const text = messageInput.value.trim();
        if (text === '') return;

        const chatRoomId = [currentUser.uid, currentChatRecipientId].sort().join('_');
        try {
            await addDoc(collection(db, "chats", chatRoomId, "messages"), {
                senderId: currentUser.uid,
                recipientId: currentChatRecipientId,
                text: text,
                timestamp: new Date()
            });
            messageInput.value = ''; // Bersihkan input
        } catch (error) {
            console.error("Error sending message:", error);
            showAlert('Gagal mengirim pesan.', 'error');
        }
    };

    // --- Leaderboard ---
    const topLikesList = document.getElementById('topLikesList');
    const topFollowersList = document.getElementById('topFollowersList');

    const fetchLeaderboards = async () => {
        if (!topLikesList || !topFollowersList) return;

        topLikesList.innerHTML = '<p class="loading-message">Memuat Top Likes...</p>';
        topFollowersList.innerHTML = '<p class="loading-message">Memuat Top Followers...</p>';

        try {
            // Top 5 Likes
            const postsSnapshot = await getDocs(collection(db, "posts"));
            const userLikes = {};
            postsSnapshot.forEach(doc => {
                const post = doc.data();
                // Pastikan post.likes adalah array
                const likesArray = Array.isArray(post.likes) ? post.likes : [];
                likesArray.forEach(uid => {
                    userLikes[uid] = (userLikes[uid] || 0) + 1;
                });
            });

            const sortedLikes = Object.entries(userLikes).sort(([, a], [, b]) => b - a).slice(0, 5);
            topLikesList.innerHTML = '';
            if (sortedLikes.length === 0) {
                topLikesList.innerHTML = '<p class="info-message">Belum ada data likes.</p>';
            } else {
                for (const [uid, likesCount] of sortedLikes) {
                    const userDoc = await getDoc(doc(db, "users", uid));
                    if (userDoc.exists()) {
                        const username = userDoc.data().username;
                        const li = document.createElement('li');
                        li.textContent = `${username} (${likesCount} Likes)`;
                        topLikesList.appendChild(li);
                    }
                }
            }


            // Top 5 Followers
            const usersSnapshot = await getDocs(collection(db, "users"));
            const sortedFollowers = [];
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                // Pastikan userData.followers adalah array
                const followersArray = Array.isArray(userData.followers) ? userData.followers : [];
                sortedFollowers.push({
                    username: userData.username,
                    followersCount: followersArray.length
                });
            });

            sortedFollowers.sort((a, b) => b.followersCount - a.followersCount);
            topFollowersList.innerHTML = '';
            if (sortedFollowers.length === 0) {
                topFollowersList.innerHTML = '<p class="info-message">Belum ada data followers.</p>';
            } else {
                sortedFollowers.slice(0, 5).forEach(user => {
                    const li = document.createElement('li');
                    li.textContent = `${user.username} (${user.followersCount} Followers)`;
                    topFollowersList.appendChild(li);
                });
            }

        } catch (error) {
            console.error("Error fetching leaderboards:", error);
            showAlert('Gagal memuat leaderboard.', 'error');
            topLikesList.innerHTML = '<p class="info-message">Gagal memuat data.</p>';
            topFollowersList.innerHTML = '<p class="info-message">Gagal memuat data.</p>';
        }
    };

    // Panggil fetchLeaderboards saat halaman Leaderboard diakses
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = e.target.getAttribute('href').substring(1);
            if (targetId === 'leaderboard' && currentUser) {
                fetchLeaderboards();
            }
        });
    });


    // --- Postingan Pengguna di Halaman Profil ---
    const userPostsContainer = document.querySelector('#profile-section .user-posts');
    const fetchUserPosts = async (userId) => {
        if (!userPostsContainer || !currentUser) return;
        userPostsContainer.innerHTML = '<h3>Postingan Saya</h3><p class="loading-message">Memuat postingan Anda...</p>'; // Reset

        try {
            const q = query(collection(db, "posts"), where("userId", "==", userId), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q); // Bisa juga pakai onSnapshot jika ingin real-time di profil

            if (querySnapshot.empty) {
                userPostsContainer.innerHTML = '<h3>Postingan Saya</h3><p class="info-message">Belum ada postingan.</p>';
                return;
            }
            userPostsContainer.innerHTML = '<h3>Postingan Saya</h3>'; // Kosongkan loading message setelah tahu ada data

            querySnapshot.forEach(doc => {
                const post = doc.data();
                const postElement = document.createElement('div');
                postElement.classList.add('post');
                postElement.innerHTML = `
                    <div class="post-header">
                        <img src="${post.profilePic || 'https://via.placeholder.com/40'}" alt="User Avatar" class="avatar">
                        <span class="username">${post.username}</span>
                    </div>
                    ${post.mediaType === 'image' ?
                        `<img src="${post.mediaURL}" alt="${post.title}" class="post-media">` :
                        `<video controls src="${post.mediaURL}" class="post-media"></video>`
                    }
                    <div class="post-actions">
                         <button class="delete-post-btn" data-post-id="${doc.id}" data-media-url="${post.mediaURL}">Hapus Post</button>
                    </div>
                    <p class="post-caption"><strong>${post.title}</strong><br>${post.description}</p>
                `;
                userPostsContainer.appendChild(postElement);

                // Event listener untuk hapus post
                postElement.querySelector('.delete-post-btn').addEventListener('click', async (e) => {
                    const postIdToDelete = e.target.dataset.postId;
                    const mediaURLToDelete = e.target.dataset.mediaUrl;
                    if (confirm('Apakah Anda yakin ingin menghapus postingan ini?')) {
                        try {
                            // Hapus file dari Storage
                            // Perlu ekstraksi path dari URL untuk deleteObject
                            const fileRefPath = decodeURIComponent(mediaURLToDelete.split('/o/')[1].split('?')[0]);
                            const fileRef = ref(storage, fileRefPath);
                            await deleteObject(fileRef).catch(err => console.warn("Could not delete file from storage (might not exist or permissions issue):", err));

                            // Hapus dokumen post dari Firestore
                            await deleteDoc(doc(db, "posts", postIdToDelete));
                            showAlert('Postingan berhasil dihapus!', 'success');
                            // Tidak perlu panggil fetchUserPosts lagi karena onSnapshot di feed sudah akan update
                            // Jika ini bukan di feed tapi di profil sendiri, kita mungkin butuh update manual atau listener
                            fetchUserPosts(currentUser.uid); // Perbarui daftar postingan di profil
                        } catch (error) {
                            console.error("Error deleting post:", error);
                            showAlert('Gagal menghapus postingan.', 'error');
                        }
                    }
                });
            });
        } catch (error) {
            console.error("Error fetching user posts:", error);
            showAlert('Gagal memuat postingan pengguna.', 'error');
            userPostsContainer.innerHTML = '<h3>Postingan Saya</h3><p class="info-message">Gagal memuat postingan Anda.</p>';
        }
    };

    // Panggil fetchUserPosts saat halaman profil diakses
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = e.target.getAttribute('href').substring(1);
            if (targetId === 'profile' && currentUser) {
                fetchAndDisplayUserProfile(currentUser.uid); // Muat ulang data profil
                fetchUserPosts(currentUser.uid); // Muat postingan saya
            }
        });
    });

    // Panggil fetchLeaderboards juga saat halaman leaderboard dimuat pertama kali
    // (Sudah ada di event listener nav, jadi ini tidak lagi perlu di sini)
    // fetchLeaderboards();
});
