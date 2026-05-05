import { io } from 'socket.io-client';

const FLASK_URL = process.env.REACT_APP_FLASK_URL || 'http://localhost:5000';

const socket = io(FLASK_URL, { autoConnect: false, transports: ['websocket'] });

export default socket;
