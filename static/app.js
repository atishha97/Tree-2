/**
 * The Holiday Tree - Vue.js Application
 */

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBVMsbvJQ_UNxhBD4YRYCustKgsOdsfjKY",
    authDomain: "tree-2-1b3ad.firebaseapp.com",
    projectId: "tree-2-1b3ad",
    storageBucket: "tree-2-1b3ad.firebasestorage.app",
    messagingSenderId: "590547257690",
    appId: "1:590547257690:web:cb44a4c852d25e67ca0b63"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Vue Application
const { createApp } = Vue;

createApp({
    data() {
        return {
            // Auth state
            user: null,
            loading: true,

            // Tree state
            currentTreeId: null,
            ownerName: '',
            ownerId: null,
            ornaments: [],

            // UI state
            isMobile: window.innerWidth < 768,
            showLanding: false,
            copied: false,
            errorMessage: '',

            // Drag state
            draggedOrnamentType: null,
            draggedOrnament: null, // For moving existing ornaments

            // Add ornament modal
            showAddModal: false,
            newOrnament: {
                type: null,
                x: 0,
                y: 0,
                senderName: '',
                message: ''
            },

            // View ornament modal
            showViewModal: false,
            selectedOrnament: null,

            // Delete confirmation
            showDeleteConfirm: false,

            // Thank You Modal
            showThankYouModal: false,
            lastAddedOrnamentType: null,

            // Rotating names

            // Rotating names
            currentLandingName: 'The',
            // So if I use "The", I shouldn't have "'s".
            landingNames: ['Jeremie', 'Arul', 'John', 'Sarah', 'Mike', 'Emily', 'David', 'Jessica'],
            landingNameIndex: 0,
            landingNameInterval: null,
            landingOrnaments: [],

            // Firestore listener
            ornamentsUnsubscribe: null,

            // Audio
            chimeAudio: null
        };
    },

    computed: {
        isOwnTree() {
            return this.user && this.user.uid === this.ownerId;
        }
    },

    async mounted() {
        // Initialize audio
        this.chimeAudio = new Audio('/assets/chime.mp3');
        this.chimeAudio.volume = 1.0;

        // Start name rotation
        this.currentLandingName = this.landingNames[0];
        this.generateRandomOrnaments(); // Initial set
        this.landingNameInterval = setInterval(() => {
            this.landingNameIndex = (this.landingNameIndex + 1) % this.landingNames.length;
            this.currentLandingName = this.landingNames[this.landingNameIndex];
            this.generateRandomOrnaments(); // New set for new name
        }, 3000);

        // Handle window resize
        window.addEventListener('resize', this.handleResize);

        // Listen for auth state changes
        auth.onAuthStateChanged(async (user) => {
            this.user = user;
            await this.handleRoute();
            this.loading = false;
        });
    },

    beforeUnmount() {
        if (this.landingNameInterval) {
            clearInterval(this.landingNameInterval);
        }
        window.removeEventListener('resize', this.handleResize);
        if (this.ornamentsUnsubscribe) {
            this.ornamentsUnsubscribe();
        }
    },

    methods: {
        handleResize() {
            this.isMobile = window.innerWidth < 768;
        },

        async handleRoute() {
            const path = window.location.pathname;

            // Check if we're on a tree page
            const treeMatch = path.match(/^\/tree\/(.+)$/);

            if (treeMatch) {
                // Viewing a specific tree
                const treeId = treeMatch[1];
                await this.loadTree(treeId);
                this.showLanding = false;
            } else if (this.user) {
                // Signed in user at root - redirect to their tree
                await this.ensureUserTree();
            } else {
                // Anonymous user at root - show landing
                this.showLanding = true;
                this.updatePageTitle();
            }
        },

        async ensureUserTree() {
            try {
                // Check if user already has a tree
                const userDoc = await db.collection('users').doc(this.user.uid).get();

                if (userDoc.exists) {
                    // User has a tree, redirect to it
                    const treeId = userDoc.data().tree_id;
                    window.history.pushState({}, '', `/tree/${treeId}`);
                    await this.loadTree(treeId);
                } else {
                    // Create new tree for user
                    await this.createUserTree();
                }

                this.showLanding = false;
            } catch (error) {
                console.error('Error ensuring user tree:', error);
                this.showError('Failed to load your tree. Please try again.');
            }
        },

        async createUserTree() {
            try {
                // Create tree document
                const treeRef = await db.collection('trees').add({
                    owner_id: this.user.uid,
                    owner_name: this.user.displayName || 'Anonymous',
                    created_at: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Create user document linking to tree
                await db.collection('users').doc(this.user.uid).set({
                    tree_id: treeRef.id,
                    display_name: this.user.displayName || 'Anonymous',
                    created_at: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Navigate to the new tree
                window.history.pushState({}, '', `/tree/${treeRef.id}`);
                await this.loadTree(treeRef.id);
            } catch (error) {
                console.error('Error creating tree:', error);
                this.showError('Failed to create your tree. Please try again.');
            }
        },

        async loadTree(treeId) {
            try {
                // Load tree data
                const treeDoc = await db.collection('trees').doc(treeId).get();

                if (!treeDoc.exists) {
                    this.showError('Tree not found');
                    return;
                }

                const treeData = treeDoc.data();
                this.currentTreeId = treeId;
                this.ownerId = treeData.owner_id;
                this.ownerName = treeData.owner_name;

                // Update title and meta
                this.updatePageTitle(this.ownerName);

                // Subscribe to ornaments
                this.subscribeToOrnaments(treeId);
            } catch (error) {
                console.error('Error loading tree:', error);
                this.showError('Failed to load tree. Please try again.');
            }
        },

        subscribeToOrnaments(treeId) {
            // Unsubscribe from previous listener if any
            if (this.ornamentsUnsubscribe) {
                this.ornamentsUnsubscribe();
            }

            let initialLoad = true;

            // Real-time listener for ornaments
            this.ornamentsUnsubscribe = db.collection('ornaments')
                .where('tree_id', '==', treeId)
                .orderBy('created_at', 'asc')
                .onSnapshot(
                    (snapshot) => {
                        // Update state
                        this.ornaments = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));

                        // Check for additions to play sound
                        if (!initialLoad) {
                            snapshot.docChanges().forEach((change) => {
                                if (change.type === 'added') {
                                    const data = change.doc.data();
                                    // Play sound ONLY if it wasn't created by us (we play that manually)
                                    // OR if we are anonymous (creator_id is null/diff)
                                    // But to be safe, if we have a user and it matches, skip.
                                    const isMyOrnament = this.user && data.creator_id === this.user.uid;

                                    // Also check if it has pending writes (local change) to double verify
                                    const isLocal = change.doc.metadata.hasPendingWrites;

                                    if (!isMyOrnament && !isLocal) {
                                        this.playChime();
                                    }
                                }
                            });
                        } else {
                            initialLoad = false;
                        }
                    },
                    (error) => {
                        console.error('Error listening to ornaments:', error);
                    }
                );
        },

        playChime() {
            if (this.chimeAudio) {
                try {
                    this.chimeAudio.currentTime = 0;
                    this.chimeAudio.play().catch(e => console.log('Audio playback failed (likely blocked):', e));
                } catch (err) {
                    console.error('Error playing sound:', err);
                }
            }
        },

        // Authentication
        goToLanding() {
            window.location.href = '/';
        },

        async signIn() {
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                await auth.signInWithPopup(provider);
                // Auth state change handler will take care of the rest
            } catch (error) {
                console.error('Sign in error:', error);
                if (error.code === 'auth/popup-blocked') {
                    this.showError('Popup was blocked. Please allow popups for this site.');
                } else {
                    this.showError('Sign in failed. Please try again.');
                }
            }
        },

        async signOut() {
            try {
                await auth.signOut();
                // Redirect to landing if on own tree
                if (this.isOwnTree) {
                    window.history.pushState({}, '', '/');
                    this.showLanding = true;
                    this.currentTreeId = null;
                    this.ornaments = [];
                    this.updatePageTitle();
                }
            } catch (error) {
                console.error('Sign out error:', error);
                this.showError('Sign out failed. Please try again.');
            }
        },

        // Ornament helpers
        getOrnamentSrc(typeOrIndex) {
            // Handle both number index and string type
            if (typeof typeOrIndex === 'number') {
                // Special case: Ornament 7 has a typo in filename
                if (typeOrIndex === 7) {
                    return '/assets/Ornanent7.png';
                }
                return `/assets/Ornament${typeOrIndex}.png`;
            } else {
                // It's already a filename string
                return `/assets/${typeOrIndex}`;
            }
        },

        // Drag and Drop
        onDragStart(event, ornamentIndex) {
            this.draggedOrnamentType = ornamentIndex;
            this.draggedOrnament = null;
            event.dataTransfer.effectAllowed = 'copy';

            // Set a drag image
            const img = event.target;
            event.dataTransfer.setDragImage(img, 20, 20);
        },

        onOrnamentDragStart(event, ornament) {
            if (!this.isOwnTree) {
                event.preventDefault();
                return;
            }

            this.draggedOrnament = ornament;
            this.draggedOrnamentType = null;
            event.dataTransfer.effectAllowed = 'move';
        },

        onDrop(event) {
            event.preventDefault();

            const dropZone = this.$refs.dropZone;
            const rect = dropZone.getBoundingClientRect();

            // Calculate percentage position
            const x = ((event.clientX - rect.left) / rect.width) * 100;
            const y = ((event.clientY - rect.top) / rect.height) * 100;

            if (this.draggedOrnament) {
                // Moving existing ornament
                this.moveOrnament(this.draggedOrnament, x, y);
            } else if (this.draggedOrnamentType) {
                // Adding new ornament
                this.openAddModal(this.draggedOrnamentType, x, y);
            }

            this.draggedOrnament = null;
            this.draggedOrnamentType = null;
        },

        // Tap to Place (Mobile)
        onPaletteClick(index) {
            // Immediately open modal with random position
            const pos = this.getRandomTreePosition();
            this.openAddModal(index, pos.x, pos.y);
        },

        onTreeClick(event) {
            // Only proceed if an ornament is selected from palette
            if (!this.selectedPaletteOrnament) return;

            const dropZone = this.$refs.dropZone;
            const rect = dropZone.getBoundingClientRect();

            // Calculate percentage position
            // Use event.touches if available (touch), otherwise clientX/Y (mouse/click)
            const clientX = event.clientX || (event.touches ? event.touches[0].clientX : 0);
            const clientY = event.clientY || (event.touches ? event.touches[0].clientY : 0);

            const x = ((clientX - rect.left) / rect.width) * 100;
            const y = ((clientY - rect.top) / rect.height) * 100;

            this.openAddModal(this.selectedPaletteOrnament, x, y);

            // Reset selection after placing
            this.selectedPaletteOrnament = null;
        },

        // Add Ornament Modal
        openAddModal(type, x, y) {
            // UNLOCK AUDIO HERE (User Interaction)
            if (this.chimeAudio) {
                this.chimeAudio.play().then(() => {
                    this.chimeAudio.pause();
                    this.chimeAudio.currentTime = 0;
                }).catch(e => {
                    // Ignore error here, it might fail if already playing or strict policy
                });
            }

            this.newOrnament = {
                type: type,
                x: x,
                y: y,
                senderName: this.user?.displayName || '',
                message: ''
            };
            this.showAddModal = true;
        },

        closeAddModal() {
            this.showAddModal = false;
            this.newOrnament = { type: null, x: 0, y: 0, senderName: '', message: '' };
        },

        async hangOrnament() {
            if (!this.newOrnament.senderName.trim() || !this.newOrnament.message.trim()) {
                return;
            }

            try {
                // Get the correct filename
                let ornamentType;
                if (this.newOrnament.type === 7) {
                    ornamentType = 'Ornanent7.png'; // Typo in filename
                } else {
                    ornamentType = `Ornament${this.newOrnament.type}.png`;
                }

                await db.collection('ornaments').add({
                    tree_id: this.currentTreeId,
                    ornament_type: ornamentType,
                    x: this.newOrnament.x,
                    y: this.newOrnament.y,
                    sender_name: this.newOrnament.senderName.trim(),
                    message: this.newOrnament.message.trim(),
                    creator_id: this.user?.uid || null,
                    created_at: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Play sound immediately for the user
                this.playChime();

                // Save type for Thank You modal before resetting
                this.lastAddedOrnamentType = this.newOrnament.type;
                this.closeAddModal();
                this.showThankYouModal = true;
            } catch (error) {
                console.error('Error adding ornament:', error);
                this.showError('Failed to add ornament. Please try again.');
            }
        },

        // Move Ornament (Owner only)
        async moveOrnament(ornament, x, y) {
            if (!this.isOwnTree) return;

            try {
                await db.collection('ornaments').doc(ornament.id).update({
                    x: x,
                    y: y
                });
            } catch (error) {
                console.error('Error moving ornament:', error);
                this.showError('Failed to move ornament. Please try again.');
            }
        },

        // View Ornament Modal
        openViewModal(ornament) {
            this.selectedOrnament = ornament;
            this.showViewModal = true;
        },

        closeViewModal() {
            this.showViewModal = false;
            this.selectedOrnament = null;
        },

        // Delete Ornament
        canDeleteOrnament(ornament) {
            if (!this.user) return false;
            // Owner can delete any ornament
            if (this.isOwnTree) return true;
            // Creator can delete their own ornament
            return ornament.creator_id === this.user.uid;
        },

        confirmDeleteOrnament() {
            this.showDeleteConfirm = true;
        },

        async deleteOrnament() {
            if (!this.selectedOrnament) return;

            try {
                await db.collection('ornaments').doc(this.selectedOrnament.id).delete();
                this.showDeleteConfirm = false;
                this.closeViewModal();
            } catch (error) {
                console.error('Error deleting ornament:', error);
                this.showError('Failed to remove ornament. Please try again.');
            }
        },

        // Thank You Modal CTA
        handleCreateTreeCTA() {
            this.showThankYouModal = false;
            // If user is already signed in, go to their tree
            if (this.user) {
                this.ensureUserTree();
            } else {
                // otherwise trigger sign in (which will redirect to tree on success)
                this.signIn();
            }
        },

        // Share link
        async copyShareLink() {
            const url = `${window.location.origin}/tree/${this.currentTreeId}`;
            try {
                await navigator.clipboard.writeText(url);
                this.copied = true;
                setTimeout(() => { this.copied = false; }, 2000);
            } catch (error) {
                console.error('Failed to copy:', error);
                this.showError('Failed to copy link');
            }
        },

        // Utility functions
        generateRandomOrnaments() {
            const count = Math.floor(Math.random() * 5) + 4; // 4 to 8 ornaments
            const newOrnaments = [];
            for (let i = 0; i < count; i++) {
                const pos = this.getRandomTreePosition();
                newOrnaments.push({
                    id: Date.now() + i,
                    x: pos.x,
                    y: pos.y,
                    ornament_type: Math.floor(Math.random() * 8) + 1
                });
            }
            this.landingOrnaments = newOrnaments;
        },

        getRandomTreePosition() {
            // Triangle distribution to match tree shape

            // Random Y between 20% (top) and 85% (bottom)
            // Adjusted: top should be a bit lower to avoid star
            const y = Math.floor(Math.random() * 60) + 25; // Logic: 25 to 85

            // Calculate allowable X width based on Y (wider at bottom)
            // Linear interpolation:
            // At y=20, width variance is +/- 5%
            // At y=85, width variance is +/- 30%
            // Slope = (30 - 5) / (85 - 20) = 25 / 65 ≈ 0.38

            const variance = 5 + (y - 20) * 0.38;

            // Random X centered at 50%
            const xOffset = (Math.random() * 2 - 1) * variance; // -variance to +variance
            const x = 50 + xOffset;

            return { x: Math.round(x), y: Math.round(y) };
        },
        formatDate(timestamp) {
            if (!timestamp) return '';
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        },

        showError(message) {
            this.errorMessage = message;
            setTimeout(() => { this.errorMessage = ''; }, 5000);
        },

        updatePageTitle(name = null) {
            const title = name ? `${name}'s Holiday Tree` : 'The Holiday Tree';
            document.title = title;

            // Update OpenGraph title if it exists
            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle) {
                ogTitle.setAttribute('content', title);
            }
        }
    }
}).mount('#app');
