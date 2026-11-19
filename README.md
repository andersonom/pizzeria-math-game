# De Pizza — Floor Plan Challenge

A 2D browser game prototype built with Phaser and JavaScript. Levels are randomly generated, and game settings are defined in `data/config.json`.

## Run locally

Open this folder in VS Code and start a local server, for example with the **Live Server** extension. Then open `index.html` through the server. The page must be served locally to load the level JSON file.

You can also start a simple server from this folder in the terminal:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser. Phaser is loaded from a CDN, so an internet connection is required.

## Controls

- Select a room and drag on the floor plan to draw a rectangle.
- Select a table and click on the floor plan to place it.
- Use **Move** to reposition a piece or **Remove** to delete one.
- The 8-seat table can be rotated.
- The timer starts when you click **Start Phase**; the floor plan is validated automatically after 60 seconds.
