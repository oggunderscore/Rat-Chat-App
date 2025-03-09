import asyncio
import websockets
import json
import os

clients = {}
UPLOAD_DIR = "uploads"  # Directory to store uploaded files

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

async def handler(websocket):
    try:
        initial_message = await websocket.recv()
        initial_data = json.loads(initial_message)
        username = initial_data.get("username", "Unknown")

        clients[websocket] = username  # Store username
        print(f"User {username} connected")

        join_message = json.dumps({"sender": "System", "message": f"{username} has joined the chat"})
        await asyncio.gather(*[client.send(join_message) for client in clients])

        async for message in websocket:
            if isinstance(message, bytes):  
                await handle_file_upload(websocket, message, username)
            else:
                try:
                    data = json.loads(message)
                    if data.get("type") == "request_file":
                        await send_file(websocket, data.get("filename"))
                    else:
                        formatted_message = {
                            "sender": username, 
                            "message": data.get("message", "")
                        }
                        json_data = json.dumps(formatted_message)

                        await asyncio.gather(*[client.send(json_data) for client in clients])
                        print(f"Broadcasting message from {username}: {data.get('message', '')}")
                except json.JSONDecodeError:
                    print("Received invalid JSON")
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        print(f"User {username} disconnected")
        clients.pop(websocket, None)

        leave_message = json.dumps({"sender": "System", "message": f"{username} has left the chat"})
        await asyncio.gather(*[client.send(leave_message) for client in clients])


async def handle_file_upload(websocket, file_data, username):
    filename = f"{username}_{int(asyncio.get_event_loop().time())}.bin"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(file_data)

    print(f"File received and saved as {filename}")

    response = json.dumps({"type": "file_uploaded", "filename": filename, "message": f"{username} uploaded a file."})
    await asyncio.gather(*[client.send(response) for client in clients])


async def send_file(websocket, filename):
    """Handles file requests by sending the requested file."""
    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        await websocket.send(json.dumps({"status": "error", "message": "File not found"}))
        return

    with open(file_path, "rb") as f:
        file_data = f.read()

    print(f"Sending file: {filename}")
    await websocket.send(file_data)  


async def main():
    async with websockets.serve(handler, "0.0.0.0", 8765):
        print("WebSocket Server is running on ws://0.0.0.0:8765")
        await asyncio.Future()  # Keep server running

asyncio.run(main())
