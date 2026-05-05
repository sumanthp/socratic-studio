import asyncio
import websockets
import json

async def test_ws():
    uri = "ws://localhost:8000/ws/execute"
    async with websockets.connect(uri) as websocket:
        await websocket.send(json.dumps({"code": "print('Hello from test')"}))
        
        while True:
            try:
                response = await websocket.recv()
                print(f"Received: {response}")
                data = json.loads(response)
                if data.get("status") == "completed":
                    break
            except websockets.exceptions.ConnectionClosed:
                print("Connection closed")
                break

asyncio.run(test_ws())
