# Rat Chat App

RatChat is a WebSocket-based real-time messaging application designed for secure and efficient communication. It supports features such as encrypted messaging, file sharing, and multiple chatrooms.

## Production Link
https://rat-chat.netlify.app/ 

## Uptime Status
https://uptime-kuma-production-4845.up.railway.app/status/rat-chat 

## Features

- **Real-Time Messaging**: Communicate instantly with other users using WebSocket technology.
- **Encrypted Messaging**: Messages are encrypted for secure communication.
- **File Sharing**: Upload and download files
- **Multiple Chatrooms**: Create and join chatrooms for group discussions.
- **Typing Indicators**: See when other users are typing in real-time.
- **Online Users List**: View a list of currently online users.
- **Direct Messaging**: Send private messages to specific users.
- **Channel Management**: Create, join, and manage chatrooms dynamically.

## Usage

### Starting the WebSocket Server

1. Ensure you have Python 3.8 or later installed.
2. Clone the repository or download the `server.py` file.
3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the server:
   ```bash
   python3 server.py
   ```
5. The server will run on `ws://0.0.0.0:8765` by default. You can modify the host and port in the `server.py` file if needed.

### Running the Web Client

1. Navigate to the `src` directory of the project.
2. Install the required dependencies for the web app:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```
4. Open your browser and navigate to `http://localhost:3000` to access the RatChat web client.

### Configuration

- **Firebase Setup**: Ensure you have a Firebase project set up and provide the credentials file path via the `FIREBASE_ADMIN_CREDS_PATH` environment variable.
- **Uploads Directory**: Files uploaded by users are stored in the `uploads` directory.
- **Logs Directory**: Server logs are stored in the `logs` directory.

## server.py

The `server.py` script is the backbone of RatChat. It handles WebSocket connections, manages chatrooms, and processes messages and file uploads. The server is designed to be lightweight and efficient, making it suitable for local or cloud deployment.

### Key Features of `server.py`

- Handles WebSocket connections for real-time communication.
- Manages chatroom creation, deletion, and user membership.
- Processes file uploads in chunks
- Logs messages and events to Firestore for persistence.

## Contributing

Contributions are welcome! If you'd like to contribute to RatChat, please fork the repository and submit a pull request.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
