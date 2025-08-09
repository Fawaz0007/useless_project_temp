<img width="3188" height="1202" alt="frame (3)" src="https://github.com/user-attachments/assets/517ad8e9-ad22-457d-9538-a9e62d137cd7" />


# Duck Hunt - The Reckoning! 🎯


## Basic Details
### Team Name: CodeBlooded


### Team Members
- Team Lead: Fayiz Muhammad
- Member 2: Fawaz Basheer

### Project Description
An over-the-top parody of the classic Duck Hunt. You shoot ducks on a retro-styled CRT canvas, but the ducks resurrect, mock you with taunts, and retaliate by firing eggs at your crosshair. Endless rounds escalate difficulty, with chiptune beeps, hit flashes, yolk splats, and a very unhelpful dog.

### The Problem (that doesn't exist)
Classic duck games don’t prepare you for the harsh reality of immortal, vengeful waterfowl who can aim back. Also, there’s never enough yolk on the screen.

### The Solution (that nobody asked for)
Make the ducks resurrect, taunt you with little signs, and throw eggs at your cursor while a happy tune abruptly switches to a minor key. Add a CRT overlay, hit flashes, fake highscores, and a dog that shrugs at your misery. Problem solved.

## Technical Details
### Technologies/Components Used
For Software:
- Languages: HTML, CSS, JavaScript (ES6)
- Frameworks: None
- Libraries: None
- APIs/Tools: HTML5 Canvas API, Web Audio API, Google Fonts (`Press Start 2P`), Shields.io badges

For Hardware:
- None
- Not applicable
- Not applicable

### Implementation
For Software:
# Installation
No installation needed. It’s a static site.

# Run
Option 1: open `index.html` in your browser.

Option 2: serve locally (recommended):

```bash
# Python
python3 -m http.server 5500
# then open http://localhost:5500/

# Or Node (if you have it)
npx serve --single --listen 5500 --yes
```

Controls: Mouse to aim, Click to shoot, P to pause/resume, ESC to end game.

### Project Documentation
For Software:

# Screenshots (Add at least 3)
<img width="1440" height="900" alt="Screen Shot 2025-08-09 at 6 52 30 AM" src="https://github.com/user-attachments/assets/51505423-fd3b-49a7-af1b-a00fe42d53f8" />
<img width="1440" height="900" alt="Screen Shot 2025-08-09 at 6 52 47 AM" src="https://github.com/user-attachments/assets/0256a126-90c4-4bf3-907a-4d62e49823ea" />
<img width="1440" height="900" alt="Screen Shot 2025-08-09 at 6 53 04 AM" src="https://github.com/user-attachments/assets/31b9d66d-5ef9-4d28-92d5-a3a12c7a62bb" />

# Diagrams
![Workflow](docs/architecture.png)
Simple architecture: static HTML + CSS + JS. Canvas does rendering and game loop; Web Audio handles SFX/music; DOM for HUD/overlays.

For Hardware:
Not applicable

### Project Demo
# Video


https://github.com/user-attachments/assets/a6283f18-eb09-48dc-bc1a-0eac0959fc68



# Additional Demos
N/A

## Team Contributions
- Fayiz Muhammad (Team Lead): Core game loop, duck AI/state machine (fly/shot/ground/resurrect/taunt/attack/escape), scoring/round escalation, input handling.
- Fawaz Basheer: UI/HUD, CSS CRT overlay and effects, taunt/yolk/crack DOM overlays, audio cues/themes, overall polish.

---
Made with ❤️ at TinkerHub Useless Projects 

![Static Badge](https://img.shields.io/badge/TinkerHub-24?color=%23000000&link=https%3A%2F%2Fwww.tinkerhub.org%2F)
![Static Badge](https://img.shields.io/badge/UselessProjects--25-25?link=https%3A%2F%2Fwww.tinkerhub.org%2Fevents%2FQ2Q1TQKX6Q%2FUseless%2520Projects)



