import websockets
import json

# Client list
clients = {}

# Websocket handler
async def handler(websocket):
    async for message in websocket:
        data = json.loads(message)
        if data['type'] == 'register':
            clients[data['id']] = websocket
        elif data['type'] == 'message':
            await clients[data['to']].send(json.dumps({
                'type': 'message',
                'from': data['from'],
                'message': data['message']
            }))
            
            