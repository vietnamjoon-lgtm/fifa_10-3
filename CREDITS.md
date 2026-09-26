# Credits

Third-party data used by Project Touchline. License texts for code and other assets are in `licenses/`.

## Motion capture

### 100STYLE (walk, jog, run, turn and stop clips)

The `walk`, `jog`, `run`, `turn` and `stop` clips in `src/mocap-data.js` are derived from the **Neutral** style of the
100STYLE dataset:

- Ian Mason, Sebastian Starke and Taku Komura. *Real-Time Style Modelling of Human Locomotion via Feature-Wise
  Transformations and Local Motion Phases.* Proceedings of the ACM on Computer Graphics and Interactive Techniques
  5(1), article 6, 2022. https://doi.org/10.1145/3522618
- Dataset: 100STYLE, https://zenodo.org/records/8127870 (project page https://www.ianxmason.com/100style/)
- License: Creative Commons Attribution 4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/

Source files: `Neutral_FW.bvh`, `Neutral_FR.bvh` and `Neutral_TR1.bvh`, trimmed with the dataset's `Frame_Cuts.csv`.
The exact frame ranges and file hashes are in `tools/anim/100style-selection.json`.

**Changes made:** single cycles and segments were cut from the takes, retargeted from the 100STYLE skeleton to the
game's 13-joint rig (`tools/anim/bvh-export.py` in Blender, then `tools/anim/convert-100style.mjs`), made in-place,
time-warped so the right foot lands exactly half a cycle after the left, and blended at the loop seam. The original
BVH files are not included in this repository.

### CMU Graphics Lab Motion Capture Database (kick clip)

The `kick` clip is retargeted from CMU motion 10_01. The data comes from mocap.cs.cmu.edu, created with funding from
NSF EIA-0196217. See `licenses/CMU-MOCAP.txt`.
