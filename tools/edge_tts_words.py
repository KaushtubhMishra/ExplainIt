# Called by the Node voice adapter. Reads {"text","voice","mp3"} as JSON on stdin,
# writes the MP3, and prints the word timings as JSON on stdout.
import asyncio, json, sys
import edge_tts

async def main():
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    req = json.loads(sys.stdin.read())
    try:
        comm = edge_tts.Communicate(req["text"], req["voice"], rate=req.get("rate", "+0%"), boundary="WordBoundary")
    except TypeError:  # older edge-tts versions report word boundaries by default
        comm = edge_tts.Communicate(req["text"], req["voice"], rate=req.get("rate", "+0%"))
    words = []
    with open(req["mp3"], "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 1e7  # offsets are in 100-nanosecond units
                words.append({"word": chunk["text"], "start": start, "end": start + chunk["duration"] / 1e7})
    print(json.dumps({"words": words}, ensure_ascii=False))

asyncio.run(main())
