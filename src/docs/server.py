import asyncio
import websockets
import json

# Store connected clients and their usernames
clients = {}

async def handler(websocket, path):  # Include the 'path' argument
    try:
        # Receive the initial message containing the username
        initial_message = await websocket.recv()
        initial_data = json.loads(initial_message)
        username = initial_data.get("username")

        # Store the websocket and username
        clients[websocket] = username

        # Notify all clients about the new connection
        join_message = json.dumps({"user": "System", "message": f"{username} has joined the chat"})
        await asyncio.gather(*[client.send(join_message) for client in clients])

        async for message in websocket:
            data = json.loads(message)
            data["user"] = username  # Add the username to the message data
            json_data = json.dumps(data)

            # Broadcast the message to all connected clients
            await asyncio.gather(*[client.send(json_data) for client in clients])
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        # Remove the client on disconnect
        if websocket in clients:
            username = clients.pop(websocket)
            leave_message = json.dumps({"user": "System", "message": f"{username} has left the chat"})
            await asyncio.gather(*[client.send(leave_message) for client in clients])

async def main():
    async with websockets.serve(handler, "0.0.0.0", 8765):
        print("WebSocket Server is running on ws://0.0.0.0:8765")
        await asyncio.Future()  # Keep the server running indefinitely

# Run the server
asyncio.run(main())