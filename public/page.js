/** The core Vue instance controlling the UI */
const vm = new Vue ({
  el: '#vue-instance',
  data () {
    return {
      cryptWorker: null,
      socket: null,
      originPublicKey: null,
      destinationPublicKey: null,
      messages: [],
      notifications: [],
      currentRoom: null,
      pendingRoom: Math.floor(Math.random() * 1000),
      draft: ''
    }
  },
  async created () {
    this.addNotification('Welcome! Generating a new keypair now.');

    this.cryptWorker = new Worker('crypto-worker.js');
    this.originPublicKey = await this.getWebWorkerResponse('generate-keys');
    this.addNotification('Keypair Generated');

    this.socket = io();
    this.setupSocketListeners();
  },
  methods: {
    /** Append a notification message in the UI */
    addNotification(message) {
      const timestamp = new Date().toLocaleTimeString()
      this.notifications.push({ message, timestamp })
    },
    setupSocketListeners() {
        this.socket.on('connect', () => {
            this.addNotification('Connected to Server');
            this.joinRoom();
        })

        this.socket.on('disconnect', () => {
            this.addNotification('Lost Connection');
        });

        this.socket.on('MESSAGE', async message => {
            if (message.recipient === this.originPublicKey) {
                message.text = await this.getWebWorkerResponse('decrypt', message.text);

                this.addMessage(message);
            }
        });

        this.socket.on('NEW_CONNECTION', () => {
            this.addNotification('Another user joined the room.');
            this.sendPublicKey();
        });

        this.socket.on('ROOM_JOINED', newRoom => {
            this.currentRoom = newRoom;

            this.addNotification(`Joined Room - ${this.currentRoom}`);
            this.sendPublicKey();
        });

        this.socket.on('PUBLIC_KEY', key => {
            this.addNotification(`Public Key Received - ${this.getKeySnippet(key)}`);
            this.destinationPublicKey = key;
        });

        this.socket.on('user disconnected', () => {
            this.addNotification(`User Disconnected - ${this.getKeySnippet(this.destinationKey)}`);
            this.destinationPublicKey = null;
        });
    },
    async sendMessage() {
        if (this.draft) {
            const message = Immutable.Map({
                text: this.draft,
                recipient: this.destinationPublicKey,
                sender:this.originPublicKey,
            });
            this.draft = '';
            this.addMessage(message.toObject());
            if (this.destinationPublicKey) {
                const encryptedText = await this.getWebWorkerResponse(
                    'encrypt', [message.get('text'), this.destinationPublicKey]);
                const encryptedMsg = message.set('text', encryptedText);

                this.socket.emit('MESSAGE', encryptedMsg.toObject());
            }
        }
    },
    joinRoom() {
        this.socket.emit('JOIN');
    },
    addMessage(message) {
      console.log(this.originPublicKey);
        this.messages.push(message);
    },
    getWebWorkerResponse(messageType, messagePayload) {
        return new Promise((resolve, reject) => {
            const messageId = Math.floor(Math.random() * 100000); // use uuid

            this.cryptWorker.postMessage([messageType, messageId].concat(messagePayload));

            const handler = e => {
                if (e.data[0] === messageId) {
                    e.currentTarget.removeEventListener(e.type, handler);
                    resolve(e.data[1]);
                }
            }

            this.cryptWorker.addEventListener('message', handler);
        })
    },
    sendPublicKey() {
        if( this.originPublicKey) {
            this.socket.emit('PUBLIC_KEY', this.originPublicKey);
        }
    },
    getKeySnippet(key) {
        return key.slice(400, 416);
    }
  }
})
