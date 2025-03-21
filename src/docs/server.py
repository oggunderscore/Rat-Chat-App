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

        async for message in websocket:
            if isinstance(message, bytes):
                await handle_file_upload(websocket, message, username, chatroom)
            else:
                try:
                    data = json.loads(message)
                    if data.get("type") == "request_file":
                        await send_file(websocket, data.get("filename"))
                    else:
                        formatted_message = {
                            "sender": username,
                            "chatroom": chatroom,
                            "message": data.get("message", "")
                        }
                        json_data = json.dumps(formatted_message)
                        if "_" in chatroom:  # Flag for DM channel
                            await send_to_dm_channel(chatroom, json_data)
                        else:
                            await broadcast_to_chatroom(chatroom, json_data)
                        print(f"Broadcasting message in {chatroom} from {username}: {data.get('message', '')}")
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

async def handle_file_upload(websocket, file_data, username, chatroom):
    filename = f"{username}_{int(asyncio.get_event_loop().time())}.bin"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(file_data)

    print(f"File received and saved as {filename}")

    response = json.dumps({
        "type": "file_uploaded",
        "chatroom": chatroom,
        "filename": filename,
        "message": f"{username} uploaded a file."
    })
    await broadcast_to_chatroom(chatroom, response)

async def send_file(websocket, filename):
    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        await websocket.send(json.dumps({"status": "error", "message": "File not found"}))
        return

    with open(file_path, "rb") as f:
        file_data = f.read()

    print(f"Sending file: {filename}")
    await websocket.send(file_data)

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
