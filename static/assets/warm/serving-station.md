# Approved serving station

`serving-station.png` is the user's approved first option: a compact metal
hood above a pale pad with a broad triangular arrow. It was generated using
the built-in image-generation tool and copied here unchanged.

The companion atlas metadata selects the square tile within the transparent
source padding. Phaser scales it to the same tile dimensions as the terrain;
the terrain atlas builder does not overwrite this separate asset.

The source arrow points up. The renderer rotates the complete station around
its tile center so the broad base faces the walkable approach and the tip faces
into the station. Edge stations prefer the inward approach; a station with
only one walkable neighbor uses that neighbor. Interior stations with several
approaches keep the source orientation and remain usable from all legal sides.
