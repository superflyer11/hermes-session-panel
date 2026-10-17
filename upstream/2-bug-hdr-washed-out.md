# Draft issue 2 (bug) — not posted

**Title:** desktop (Linux/Wayland): UI renders washed out on an HDR monitor when the NVIDIA SwiftShader fallback is active

**Affected component:** Other (Desktop app, rendering)

## Bug Description

On a KDE Plasma Wayland session with HDR enabled on one monitor, Hermes
Desktop looks grey and low-contrast on that monitor: a `#151515` theme
background displays as roughly `#363636`, and text is dimmed. The same
window looks correct on the SDR monitors. Other Electron apps on the same
HDR monitor (for example one running with `--disable-gpu`) render correctly.

Hermes was running with the NVIDIA EGL fallback active (log:
"NVIDIA EGL fallback enabled (witnessed GPU-process death …); routing ANGLE
through SwiftShader").

## Steps to Reproduce

1. KDE Plasma 6 Wayland, NVIDIA GPU, one monitor with HDR enabled
   (System Settings → Display & Monitor → Enable HDR).
2. Run Hermes Desktop with the SwiftShader fallback active.
3. Put the window on the HDR monitor, then on an SDR monitor, and compare.

## Expected Behavior

The same colours on both monitors, as for other SDR apps on the HDR output.

## Actual Behavior

Blacks are lifted and text dimmed on the HDR monitor only.

## Workaround

Add `--disable-gpu` to `desktop.electron_flags` in `config.yaml`. Rendering
is then correct on the HDR monitor.

## Related

#131321, #123422, #124032 (SwiftShader fallback stickiness and visibility).
This one adds a visible symptom on HDR outputs.

## Environment

- Hermes Agent v0.22.2 (d923a5eb), Electron 40.10.2
- CachyOS Linux, kernel 7.2.10, KDE Plasma 6.8.0 (Wayland)
- NVIDIA RTX 5070 Ti, driver 615.78.08 (open kernel module)
- HDR monitor: 2560x1440, SDR brightness 358 nits

## Debug Report

Not attached: `hermes debug share` uploads config and logs to a public paste
service. Happy to share specific log lines on request.
