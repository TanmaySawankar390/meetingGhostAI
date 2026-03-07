"""
Meeting Ghost AI — Meeting Simulator
======================================
Simulates a meeting by sending text messages over WebSocket.
Useful for testing the full pipeline without actual audio.

Usage:
    python scripts/meeting_simulator.py
"""

import asyncio, json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import websockets

WS_URL = "ws://localhost:8000/ws/meeting/sim-test-001"

# Simulated meeting conversation
MEETING_SCRIPT = [
    {"speaker": "Manager", "text": "Good morning everyone. Let's start the sprint planning meeting.", "delay": 1},
    {"speaker": "Designer", "text": "I have the mockups ready for the new dashboard.", "delay": 2},
    {"speaker": "Manager", "text": "Great. Rahul, when will the API be ready for the dashboard integration?", "delay": 2},
    # ^ This should trigger an AI response (directed at Rahul)
    {"speaker": "QA Lead", "text": "I'd like to discuss the testing strategy for the new features.", "delay": 3},
    {"speaker": "Designer", "text": "The design system components are all updated in Figma.", "delay": 2},
    {"speaker": "Manager", "text": "Rahul, can you handle the deployment to staging?", "delay": 2},
    # ^ This should also trigger a response
    {"speaker": "Product Owner", "text": "We need to prioritize the client feedback items.", "delay": 2},
    {"speaker": "QA Lead", "text": "The regression tests are passing on the current build.", "delay": 2},
    {"speaker": "Manager", "text": "Let's schedule the design review for Thursday.", "delay": 2},
    {"speaker": "Designer", "text": "Rahul, do you have any thoughts on the color scheme?", "delay": 2},
    # ^ This should also trigger a response
    {"speaker": "Manager", "text": "Alright, anything else before we wrap up?", "delay": 2},
    {"speaker": "Product Owner", "text": "Let's make sure the budget report is ready by Friday.", "delay": 2},
]


async def run_simulation():
    """Run the meeting simulation."""
    print("=" * 60)
    print("  Meeting Ghost AI — Meeting Simulator")
    print("=" * 60)
    print(f"\nConnecting to: {WS_URL}")

    try:
        async with websockets.connect(WS_URL) as ws:
            # Wait for connection status
            status = await ws.recv()
            status_data = json.loads(status)
            print(f"\n✅ {status_data.get('message', 'Connected')}\n")
            print("-" * 60)

            # Send each message in the script
            for i, msg in enumerate(MEETING_SCRIPT, 1):
                await asyncio.sleep(msg["delay"])

                # Send as text_input (not audio)
                payload = {"type": "text_input", "speaker": msg["speaker"], "text": msg["text"]}
                await ws.send(json.dumps(payload))
                print(f"\n[{i:02d}] 🎤 {msg['speaker']}: {msg['text']}")

                # Wait for and display server responses
                try:
                    while True:
                        response = await asyncio.wait_for(ws.recv(), timeout=1.0)
                        data = json.loads(response)

                        if data["type"] == "transcript":
                            print(f"     📝 Transcript confirmed: [{data['speaker']}] {data['text']}")
                        elif data["type"] == "response":
                            print(f"\n     🤖 AI RESPONSE: {data['text']}")
                            print(f"        Confidence: {data.get('confidence', 'N/A')}")
                            print(f"        Reasoning: {data.get('reasoning', 'N/A')}")
                        elif data["type"] == "status":
                            print(f"     ℹ️ Status: {data['message']}")
                        elif data["type"] == "error":
                            print(f"     ❌ Error: {data['message']}")
                except asyncio.TimeoutError:
                    pass  # No more messages to receive

            # End the meeting
            print("\n" + "-" * 60)
            print("\n📋 Ending meeting...")
            await ws.send(json.dumps({"type": "end_meeting"}))

            # Collect final responses
            try:
                while True:
                    response = await asyncio.wait_for(ws.recv(), timeout=3.0)
                    data = json.loads(response)
                    if data["type"] == "status":
                        print(f"   ℹ️ {data['message']}")
            except (asyncio.TimeoutError, websockets.exceptions.ConnectionClosed):
                pass

            print("\n✅ Simulation complete!")
            print("=" * 60)

    except ConnectionRefusedError:
        print("\n❌ Cannot connect to backend server!")
        print("   Make sure the backend is running:")
        print("   cd backend && uvicorn main:app --reload")
    except Exception as e:
        print(f"\n❌ Error: {e}")


if __name__ == "__main__":
    asyncio.run(run_simulation())
