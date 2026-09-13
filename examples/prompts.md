# Practical Prompt Examples

Use these prompts to guide AI agents when creating interactive tutorial videos.

## 1. End-to-End Tutorial Creation

```text
Use interactive-tutorial-video to record a full HD tutorial video for our new billing feature.
1. Use Playwright to automate the flow from login to invoice creation.
2. Inject the tutorial engine HUD to highlight each input field and button with the pulsing green spotlight and floating tooltip pill.
3. Show the frosted glass banner at the bottom with step numbers and clear descriptions.
4. Add synchronized Arabic voiceover (ar-SA-ZariyahNeural) explaining each step.
5. Mux audio and video in 1080p, then verify the final MP4 size and duration.
```

## 2. Voiceover & Muxing Only

```text
Use interactive-tutorial-video to add neural voiceover to our raw screen recording ./raw_demo.mp4.
Generate voiceover using ar-LY-ImanNeural based on the script in ./voice_script.json.
Synchronize each sentence to the exact timestamp using ffmpeg adelay filters and export as 1080p MP4.
```

## 3. Autonomous YouTube Upload & Playlist

```text
Use interactive-tutorial-video to upload all 5 tutorial videos in ./dist/videos to YouTube.
Set visibility to unlisted, add descriptions from the manifest, and group them into a new unlisted playlist named 'POS Training Suite'.
Extract the playlist share link and output a markdown summary table.
```
