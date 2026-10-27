# Engine spike: one station with AutoDJ, a schedule queue, and live input.
settings.log.stdout := true
settings.log.level := 3
settings.server.telnet := true
settings.server.telnet.bind_addr := "0.0.0.0"
settings.harbor.bind_addrs := ["0.0.0.0"]

pw = environment.get("ICECAST_SOURCE_PASSWORD")
live_pw = environment.get("HARBOR_PASSWORD")

# 1. AutoDJ rotation (lowest priority)
auto = mksafe(playlist(id="auto", mode="randomize", "/media/auto"))
# 2. Scheduled items: the control platform pushes a file at its slot time
sched = request.queue(id="sched")
# 3. Live presenter (browser via websocket, or any Icecast source client)
live = input.harbor(id="live", "live", port=8005, password=live_pw, buffer=2., max=10.)

radio = fallback(id="radio", track_sensitive=false, [live, sched, auto])
output.icecast(%mp3(bitrate=64), host="icecast", port=8000, password=pw, mount="/spike", name="Spike FM", radio)

# Spike instrumentation: precise wall-clock time each track goes on air.
radio.on_track(fun (m) -> log.important(label="onair", 'ONAIR rid=#{m["rid"]} t=#{time()}'))
