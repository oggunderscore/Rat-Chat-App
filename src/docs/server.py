import asyncio
import websockets
import json
import os

clients = {}
chatrooms = {"general": set()}  # Dictionary to store chatrooms and their clients
UPLOAD_DIR = "uploads"

os.makedirs(UPLOAD_DIR, exist_ok=True)

async def handler(websocket):
    try:
        initial_message = await websocket.recv()
        initial_data = json.loads(initial_message)
        username = initial_data.get("username", "Unknown")
        chatroom = initial_data.get("chatroom", "general")

        if chatroom not in chatrooms:
            chatrooms[chatroom] = set()
        chatrooms[chatroom].add(websocket)
        clients[websocket] = {"username": username, "chatroom": chatroom}

        print(f"User {username} connected to {chatroom}")

        await broadcast_online_users()

        join_message = json.dumps({
            "sender": "System",
            "chatroom": chatroom,
            "message": f"{username} has joined {chatroom}"
        })
        await broadcast_to_chatroom(chatroom, join_message)

        async for raw_message in websocket:
            try:
                # print(raw_message)
                message = json.loads(raw_message)
                type = message.get("type")
                # print(type)
                if type == "upload_file":
                    file_name = message.get("fileName")
                    file_data = message.get("fileData")
                    # print(file_name)
                    # print(file_data)
                    await handle_file_upload(websocket, file_name, file_data, username, chatroom)                    
                elif type == "request_file":
                    await send_file(websocket, message.get("fileName"))
                else:
                    formatted_message = {
                        "sender": username,
                        "chatroom": chatroom,
                        "message": message.get("message", "")
                    }
                    json_data = json.dumps(formatted_message)
                    if "_" in chatroom:  # Flag for DM channel
                        await send_to_dm_channel(chatroom, json_data)
                    else:
                        await broadcast_to_chatroom(chatroom, json_data)
                    print(f"Broadcasting message in {chatroom} from {username}: {message.get('message', '')}")
            except json.JSONDecodeError:
                print("Received invalid JSON")
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        user_data = clients.pop(websocket, None)
        if user_data:
            username = user_data["username"]
            chatroom = user_data["chatroom"]
            chatrooms[chatroom].remove(websocket)
            leave_message = json.dumps({
                "sender": "System",
                "chatroom": chatroom,
                "message": f"{username} has left {chatroom}"
            })
            if "_" in chatroom:  # Check if it's a DM channel
                await send_to_dm_channel(chatroom, leave_message)
            else:
                await broadcast_to_chatroom(chatroom, leave_message)
            print(f"User {username} disconnected from {chatroom}")
            await broadcast_online_users()

async def broadcast_online_users():
    """Broadcast the list of all online users to all connected clients."""
    online_users = [data["username"] for data in clients.values()]
    message = json.dumps({"type": "online_users", "users": online_users})
    await asyncio.gather(*[client.send(message) for client in clients])

async def broadcast_to_chatroom(chatroom, message):
    """Send a message to all clients in a specific chatroom."""
    if chatroom in chatrooms:
        await asyncio.gather(*[client.send(message) for client in chatrooms[chatroom]])

async def handle_file_upload(websocket, file_name, file_data, username, chatroom):
    """Handle file uploads sent as JSON with base64-encoded data."""
    try:
        print("RECEIVED INFO:")
        print(file_name)
        print(file_data)
        if not file_name or not file_data:
            await websocket.send(json.dumps({"status": "error", "message": "Invalid file upload data"}))
            return

        import base64
        decoded_file_data = base64.b64decode(file_data)
        file_path = os.path.join(UPLOAD_DIR, file_name)

        with open(file_path, "wb") as f:
            f.write(decoded_file_data)

        print(f"File received and saved as {file_name}")

        response = json.dumps({
            "type": "file_uploaded",
            "chatroom": chatroom,
            "sender": username,
            "filename": file_name,
            "message": f"{username} uploaded a file."
        })
        await broadcast_to_chatroom(chatroom, response)
    except Exception as e:
        print(f"Error handling file upload: {e}")
        await websocket.send(json.dumps({"status": "error", "message": "File upload failed"}))

async def send_file(websocket, filename):
    """Send a requested file to the client."""
    print("Rquested file: ", filename)
    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        await websocket.send(json.dumps({"status": "error", "message": "File not found"}))
        return

    try:
        with open(file_path, "rb") as f:
            file_data = f.read()

        import base64
        encoded_file_data = base64.b64encode(file_data).decode("utf-8")

        response = json.dumps({
            "type": "file_download",
            "filename": filename,
            "file_data": encoded_file_data
        })
        await websocket.send(response)
        print(f"File {filename} sent to client")
    except Exception as e:
        print(f"Error sending file: {e}")
        await websocket.send(json.dumps({"status": "error", "message": "File transfer failed"}))

async def send_to_dm_channel(dm_channel, message):
    """Send a message to both users in a DM channel."""
    users_in_channel = dm_channel.split("_")
    for client, data in clients.items():
        if data["username"] in users_in_channel:
            await client.send(message)

async def main():
    async with websockets.serve(handler, "0.0.0.0", 8765):
        print("WebSocket Server is running on ws://0.0.0.0:8765")
        await asyncio.Future()

asyncio.run(main())
