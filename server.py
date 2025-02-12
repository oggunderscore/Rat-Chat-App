import asyncio
import websockets
import json

# Client list
clients = {}

# Websocket handler
async def handler(websocket):
    async for message in websocket:
        device_name = await websocket.recv()
        clients[websocket] = device_name  # Store device name

        async for message in websocket:
            data = {"sender": device_name, "message": message}  # Prefix messages
            json_data = json.dumps(data)

            # Send the message to all connected clients
            await asyncio.gather(*[client.send(json_data) for client in clients])
            