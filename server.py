import asyncio
import websockets
import json

# Client list
clients = {}

# Websocket handler
async def handler(websocket):
    async for message in websocket:
        try: 
            device_name = await websocket.recv()
            # Store device name in the clients list
            clients[websocket] = device_name  
            async for message in websocket:
                # Prefix messages with the sender's name
                data = {"sender": device_name, "message": message}  
                json_data = json.dumps(data)

                # Send the message to all connected clients
                await asyncio.gather(*[client.send(json_data) for client in clients])
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            # Remove client on disconnect
            clients.pop(websocket, None)  
            
            