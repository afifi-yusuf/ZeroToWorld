import asyncio
import json
import websockets
import base64

async def test():
    try:
        async with websockets.connect('ws://localhost:8001') as ws:
            with open('scene.mjcf', 'r') as f:
                mjcf_xml = f.read()
            print("Sending start_sim...")
            await ws.send(json.dumps({
                "type": "start_sim",
                "mjcf_xml": mjcf_xml,
                "goal_pos": [0, 2.5]
            }))
            while True:
                msg = await ws.recv()
                data = json.loads(msg)
                if 'error' in data:
                    print("SERVER ERROR:", data['error'])
                    break
                if data.get('type') == 'frame':
                    img_data = data['image'].split(',')[1]
                    with open('/tmp/test_frame.jpg', 'wb') as img_file:
                        img_file.write(base64.b64decode(img_data))
                    print("SAVED FRAME TO /tmp/test_frame.jpg")
                    break
    except Exception as e:
        print("Exception:", e)

asyncio.run(test())
