import asyncio
import websockets
import json

clients = {}

async def handler(websocket):
    try:
        # Receive the first message as the username
        initial_message = await websocket.recv()
        initial_data = json.loads(initial_message)
        username = initial_data.get("username", "Unknown")

        clients[websocket] = username  # Store username
        print(f"User {username} connected")

        # Notify all clients about the new connection
        join_message = json.dumps({"sender": "System", "message": f"{username} has joined the chat"})
        await asyncio.gather(*[client.send(join_message) for client in clients])

        async for message in websocket:
            try:
                data = json.loads(message)  # Ensure received message is JSON
                formatted_message = {
                    "sender": username, 
                    "message": data.get("message", "")
                }
                json_data = json.dumps(formatted_message)

                # Broadcast to all clients
                await asyncio.gather(*[client.send(json_data) for client in clients])
                print(f"Broadcasting message from {username}: {data.get('message', '')}")
            except json.JSONDecodeError:
                print("Received invalid JSON")
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        # Remove disconnected client
        print(f"User {username} disconnected")
        clients.pop(websocket, None)

        leave_message = json.dumps({"sender": "System", "message": f"{username} has left the chat"})
        await asyncio.gather(*[client.send(leave_message) for client in clients])

async def main():
    async with websockets.serve(handler, "0.0.0.0", 8765):
        print("WebSocket Server is running on ws://0.0.0.0:8765")
        await asyncio.Future()  # Keep server running

asyncio.run(main())
