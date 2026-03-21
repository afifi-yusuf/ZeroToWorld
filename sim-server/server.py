import asyncio
import json
import logging
import math
import os
import cv2
import numpy as np
import websockets

import mujoco
try:
    import playground
except ImportError:
    # mujoco-playground might have a different import path
    import mujoco_playground as playground

logging.basicConfig(level=logging.INFO)

# Global pre-loaded policy
POLICY = None

def init_policy():
    global POLICY
    if POLICY is None:
        logging.info("Loading pre-trained Go1 joystick policy...")
        try:
            POLICY = playground.load_policy("go1_joystick")
            logging.info("Policy loaded.")
        except Exception as e:
            logging.error(f"Failed to load policy: {e}")
            raise

def get_joystick_command(robot_pos, goal):
    direction = goal - robot_pos[:2]
    distance = np.linalg.norm(direction)
    
    if distance < 0.3:
        return [0.0, 0.0, 0.0]  # reached goal
        
    heading = np.arctan2(direction[1], direction[0])
    # Very simple proportional turning
    return [0.8, 0.0, heading * 0.3]  # forward, lateral, turn

async def handler(websocket):
    logging.info(f"Client connected: {websocket.remote_address}")
    
    try:
        message = await websocket.recv()
        data = json.loads(message)
        
        if data.get("type") != "start_sim":
            return
            
        mjcf_xml = data.get("mjcf_xml")
        goal_pos = data.get("goal_pos") # [x, y]
        
        if not mjcf_xml or not goal_pos:
            await websocket.send(json.dumps({"error": "Missing mjcf_xml or goal_pos"}))
            return

        # Write MJCF to disk so relative <include> paths work (spot/spot.xml)
        with open("scene.mjcf", "w") as f:
            f.write(mjcf_xml)
            
        logging.info("Loading MuJoCo model...")
        model = mujoco.MjModel.from_xml_path("scene.mjcf")
        data_mj = mujoco.MjData(model)
        
        # Init renderer with tracking camera to follow Spot
        renderer = mujoco.Renderer(model, height=480, width=640)
        camera_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_CAMERA, "track")
        if camera_id == -1:
            camera_id = None # fallback to free camera
            
        # Teleport robot to start spawn point before first step
        try:
            # Finding the root joint to teleport dynamically
            data_mj.qpos[0] = goal_pos[0] # To be exact, spawn usually happens a bit back. 
            # I will spawn it slightly offset from goal or just random point so it has room to walk.
            data_mj.qpos[1] = -2.5 # starting back is safe
        except:
            pass
        
        goal_array = np.array(goal_pos)
        
        logging.info("Starting simulation loop...")
        
        # Give physics a moment to settle
        for _ in range(50):
            mujoco.mj_step(model, data_mj)
        
        step = 0
        while step < 5000:
            robot_pos = data_mj.qpos[:3]
            
            # Policy forward pass
            cmd = get_joystick_command(robot_pos, goal_array)
            
            if POLICY is not None:
                try:
                    action = POLICY(data_mj.qpos, data_mj.qvel, cmd)
                    data_mj.ctrl[:] = action
                except Exception as e:
                    pass
            else:
                # Procedural heuristic fallback walking gait for Humanoid
                t = step * 0.02
                dx, dy = cmd[0] * 0.003, cmd[1] * 0.003
                data_mj.qpos[0] += dx
                data_mj.qpos[1] += dy
                data_mj.qpos[2] = 0.85 + abs(math.sin(t * 15)) * 0.05  # Taller Bob up and down
                
                # Simple alternating limb wiggle for ALL joints safely
                for i in range(len(data_mj.ctrl)):
                    phase = i * 1.57 # stagger the joints
                    data_mj.ctrl[i] = math.sin(t * 15 + phase) * 0.6
                
            mujoco.mj_step(model, data_mj)
            
            # Broadcast frames every 5 steps
            if step % 5 == 0:
                renderer.update_scene(data_mj, camera="track" if camera_id is not None else -1)
                frame = renderer.render()
                
                # frame is RGB (height, width, 3). Convert to BGR for OpenCV
                frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                _, buffer = cv2.imencode('.jpg', frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 60])
                import base64
                base64_str = base64.b64encode(buffer.tobytes()).decode('utf-8')
                
                # Send to frontend
                await websocket.send(json.dumps({
                    "type": "frame",
                    "image": "data:image/jpeg;base64," + base64_str,
                    "step": step,
                    "pos": robot_pos.tolist(),
                    "goal_dist": float(np.linalg.norm(goal_array - robot_pos[:2]))
                }))
                
                # Slight yield to allow network IO
                await asyncio.sleep(0.01)
                
            step += 1
            
        await websocket.send(json.dumps({"type": "complete"}))
        logging.info("Simulation complete.")
        
    except websockets.exceptions.ConnectionClosed:
        logging.info("Client disconnected.")
    except Exception as e:
        logging.error(f"Error in simulation: {e}")
        try:
            await websocket.send(json.dumps({"error": str(e)}))
        except:
            pass

async def main():
    try:
        init_policy()
    except:
        pass # will catch later or just let the client connection fail
        
    logging.info("Starting WebSocket server on ws://0.0.0.0:8001")
    async with websockets.serve(handler, "0.0.0.0", 8001):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
