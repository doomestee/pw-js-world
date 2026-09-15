import { CleanProtoMessage, ISendablePacket, ProtoGen } from "pw-js-api";
import { compareObjs } from "./util/Misc.js";
import {Point} from "./types";

// soon
// export interface IZoneMembership {

// }

export class ZoneMembership {
    /**
     * This is where the calculations will be made from.
     */
    bytes: Uint8Array;

    /**
     * The width of this member.
     */
    _width: number;

    /**
     * The height of this member.
     */
    _height: number;

    constructor(width: number, height: number, bytes?: Uint8Array) {
        this.bytes = bytes ?? new Uint8Array();
        this._width = width;
        this._height = height;
    }

    /**
     * This will return a list of positions that are part of the zone.
     */
    toPositions(): Point[] {
        const membership = this.toBoolGrid();
        const positions: Point[] = [];

        for (let x = 0; x < (membership[0]?.length ?? 0); x++) {
            for (let y = 0; y < membership.length; y++) {
                if (membership[y]?.[x]) {
                    positions.push({ x, y });
                }
            }
        }

        return positions;
    }

    /**
     * This will return a list of booleans indicating whether if that area is part of a zone.
     */
    toBoolGrid(): boolean[][] {
        const grid: boolean[][] = Array.from({ length: this._height }, () => Array.from({ length: this._width }, () => false));
        const totalCells = this._width * this._height;
        if (totalCells === 0) {
            return grid;
        }

        if (this.bytes.length === 0) {
            return grid;
        }

        let current = this.bytes[0] !== 0;
        let index = 0;
        let offset = 1;

        while (index < totalCells && offset < this.bytes.length) {
            const runLength = readVarint(this.bytes, offset);
            offset = runLength.offset;

            for (let i = 0; i < runLength.length && index < totalCells; i++, index++) {
                const x = Math.floor(index / this._height);
                const y = index % this._height;
                if (y < grid.length && x < grid[y].length) {
                    grid[y][x] = current;
                }
            }

            current = !current;
        }

        return grid;
    }

    /**
     * This will create a ZoneMembership from a list of positions.
     */
    static fromPositions(positions: Point[]): ZoneMembership {
        if (positions.length === 0) {
            return this.fromBoolGrid([])
        }

        let maxX = 0
        let maxY = 0
        for (const pos of positions) {
            if (pos.x > maxX) {
                maxX = pos.x
            }
            if (pos.y > maxY) {
                maxY = pos.y
            }
        }

        const boolGrid = Array.from({ length: maxY + 1 }, () => Array.from({ length: maxX + 1 }, () => false))
        for (const pos of positions) {
            if (pos.x < 0 || pos.y < 0) {
                continue
            }
            boolGrid[pos.y][pos.x] = true
        }

        return this.fromBoolGrid(boolGrid)
    }

    /**
     * This will create a ZoneMembership from a boolean grid.
     */
    static fromBoolGrid(membership: boolean[][]): ZoneMembership {
        const height = membership.length;
        const width = membership[0]?.length ?? 0;
        const totalCells = width * height;
        if (totalCells === 0) {
            return new ZoneMembership(width, height, new Uint8Array());
        }

        const getByIndex = (index: number) => {
            const x = Math.floor(index / height);
            const y = index % height;
            return membership[y]?.[x] ?? false;
        };

        const bytes: number[] = [];
        bytes.push(getByIndex(0) ? 1 : 0);

        let index = 0;
        while (index < totalCells) {
            const current = getByIndex(index);
            let runLength = 1;
            while (index + runLength < totalCells && getByIndex(index + runLength) === current) {
                runLength++;
            }

            writeVarint(bytes, runLength);
            index += runLength;
        }

        return new ZoneMembership(width, height, Uint8Array.from(bytes));
    }
}

function readVarint(bytes: Uint8Array, offset: number): { length: number; offset: number } {
    let result = 0;
    let shift = 0;

    while (offset < bytes.length) {
        const b = bytes[offset++];
        result |= (b & 0x7f) << shift;

        if ((b & 0x80) === 0) {
            break;
        }

        shift += 7;
    }

    return { length: result, offset };
}

function writeVarint(output: number[], value: number) {
    let v = value >>> 0;
    do {
        let b = v & 0x7f;
        v >>>= 7;
        if (v !== 0) {
            b |= 0x80;
        }

        output.push(b);
    } while (v !== 0);
}

export interface IZone {
    id: string;
    name: string;
    /**
     * 32bit integer
     */
    priority: number;

    /**
     * 32bit integer - Display color as a hue (0-359)
     */
    hue: number;

    /**
     * 32bit integer
     */
    width: number;
    /**
     * 32bit integer
     */
    height: number;

    /**
     * per-block 0/1 mask, RLE-compressed
     */
    membershipRle: ZoneMembership;//Uint8Array;//IZoneMembership[];

    vision: ProtoGen.ZoneVision;
    
    /**
     * Hides the zone's interior from players outside it.
     */
    visionOutside: ProtoGen.ZoneVision;
    /**
     * Fill color (0xRRGGBB) for hidden areas; overrides the world's void color.
     */
    hasVisionColor: boolean;
    /**
     * 32bit integer
     */
    visionColor: number;
    cameraModeX: ProtoGen.ZoneCameraMode;
    cameraModeY: ProtoGen.ZoneCameraMode;
    cameraTarget: ProtoGen.ZoneCameraTarget;
    cameraMovement: ProtoGen.ZoneCameraMovement;
    /**
     * Camera follow smoothing while not locked to this zone.
     */
    cameraFollowMovement: ProtoGen.ZoneCameraMovement;
    /**
     * Lighting (darken + tint)
     */
    lighting: ProtoGen.ZoneLighting;
    /**
     * (range: 0-100)
     */
    lightDarkness: number;
    /**
     * (range: 0-359)
     */
    lightHue: number;
    /**
     * (range: 0-100)
     */
    lightTint: number;
    /**
     * 32bit integer
     */
    lightFeatherTop: number;
    /**
     * 32bit integer
     */
    lightFeatherRight: number;
    /**
     * 32bit integer
     */
    lightFeatherBottom: number;
    /**
     * 32bit integer
     */
    lightFeatherLeft: number;
    /**
     * 32bit integer
     */
    lightMarginTop: number;
    /**
     * 32bit integer
     */
    lightMarginRight: number;
    /**
     * 32bit integer
     */
    lightMarginBottom: number;
    /**
     * 32bit integer
     */
    lightMarginLeft: number;
    /**
     * 32bit integer
     */
    lightSmoothing: number;
    /**
     * Personal light carried by players inside the zone.
     */
    playerLight: ProtoGen.ZonePlayerLight;
    /**
     * 32bt integer (in px)
     */
    playerLightRadius: number;
    /**
     * (range: 0-100)
     */
    playerLightStrength: number;
    /**
     * (range: 0-359)
     */
    playerLightHue: number;
    /**
     * (range: 0-100)
     */
    playerLightSaturation: number;

    fog: ProtoGen.ZoneFog;
    /**
     * (range: 0-359)
     */
    fogHue: number;
    /**
     * (range: 0-100)
     */
    fogSaturation: number;
    /**
     * (range: 0-100)
     */
    fogOpacity: number;
    /**
     * (range: 0-100)
     */
    fogDensity: number;
    /**
     * (range: 0-359) degrees (clockwise from east)
     */
    fogDirection: number;
    /**
     * (range: 0-100)
     */
    fogSpeed: number;
    /**
     * 32bit integer
     */
    fogFeatherTop: number;
    /**
     * 32bit integer
     */
    fogFeatherRight: number;
    /**
     * 32bit integer
     */
    fogFeatherBottom: number;
    /**
     * 32bit integer
     */
    fogFeatherLeft: number;
    /**
     * 32bit integer
     */
    fogMarginTop: number;
    /**
     * 32bit integer
     */
    fogMarginRight: number;
    /**
     * 32bit integer
     */
    fogMarginBottom: number;
    /**
     * 32bit integer
     */
    fogMarginLeft: number;
    /**
     * 32bit integer
     */
    fogSmoothing: number;
    distortion: ProtoGen.ZoneDistortion;
    /**
     * (range: 0-100)
     */
    distortionStrength: number;
    /**
     * (range: 0-100)
     */
    distortionScale: number;
    /**
     * (range: 0-100)
     */
    distortionSpeed: number;
    /**
     * 32bit integer
     */
    distortionFeatherTop: number;
    /**
     * 32bit integer
     */
    distortionFeatherRight: number;
    /**
     * 32bit integer
     */
    distortionFeatherBottom: number;
    /**
     * 32bit integer
     */
    distortionFeatherLeft: number;
    /**
     * 32bit integer
     */
    distortionMarginTop: number;
    /**
     * 32bit integer
     */
    distortionMarginRight: number;
    /**
     * 32bit integer
     */
    distortionMarginBottom: number;
    /**
     * 32bit integer
     */
    distortionMarginLeft: number;
    /**
     * 32bit integer
     */
    distortionSmoothing: number;
}

/**
 * Note that the properties in this are kept in the same structure as protogen's protozone.
 * @see {ProtoGen.ProtoZone}
 */
export default class Zone implements IZone {
    //#region Properties
    id: string;
    name: string;
    /**
     * 32bit integer
     */
    priority: number;

    /**
     * 32bit integer - Display color as a hue (0-359)
     */
    hue: number;

    /**
     * 32bit integer
     */
    width: number;
    /**
     * 32bit integer
     */
    height: number;

    /**
     * per-block 0/1 mask, RLE-compressed
     */
    membershipRle: IZone["membershipRle"];

    vision: ProtoGen.ZoneVision;
    
    /**
     * Hides the zone's interior from players outside it.
     */
    visionOutside: ProtoGen.ZoneVision;
    /**
     * Fill color (0xRRGGBB) for hidden areas; overrides the world's void color.
     */
    hasVisionColor: boolean;
    /**
     * 32bit integer
     */
    visionColor: number;
    cameraModeX: ProtoGen.ZoneCameraMode;
    cameraModeY: ProtoGen.ZoneCameraMode;
    cameraTarget: ProtoGen.ZoneCameraTarget;
    cameraMovement: ProtoGen.ZoneCameraMovement;
    /**
     * Camera follow smoothing while not locked to this zone.
     */
    cameraFollowMovement: ProtoGen.ZoneCameraMovement;
    /**
     * Lighting (darken + tint)
     */
    lighting: ProtoGen.ZoneLighting;
    /**
     * (range: 0-100)
     */
    lightDarkness: number;
    /**
     * (range: 0-359)
     */
    lightHue: number;
    /**
     * (range: 0-100)
     */
    lightTint: number;
    /**
     * 32bit integer
     */
    lightFeatherTop: number;
    /**
     * 32bit integer
     */
    lightFeatherRight: number;
    /**
     * 32bit integer
     */
    lightFeatherBottom: number;
    /**
     * 32bit integer
     */
    lightFeatherLeft: number;
    /**
     * 32bit integer
     */
    lightMarginTop: number;
    /**
     * 32bit integer
     */
    lightMarginRight: number;
    /**
     * 32bit integer
     */
    lightMarginBottom: number;
    /**
     * 32bit integer
     */
    lightMarginLeft: number;
    /**
     * 32bit integer
     */
    lightSmoothing: number;
    /**
     * Personal light carried by players inside the zone.
     */
    playerLight: ProtoGen.ZonePlayerLight;
    /**
     * 32bt integer (in px)
     */
    playerLightRadius: number;
    /**
     * (range: 0-100)
     */
    playerLightStrength: number;
    /**
     * (range: 0-359)
     */
    playerLightHue: number;
    /**
     * (range: 0-100)
     */
    playerLightSaturation: number;

    fog: ProtoGen.ZoneFog;
    /**
     * (range: 0-359)
     */
    fogHue: number;
    /**
     * (range: 0-100)
     */
    fogSaturation: number;
    /**
     * (range: 0-100)
     */
    fogOpacity: number;
    /**
     * (range: 0-100)
     */
    fogDensity: number;
    /**
     * (range: 0-359) degrees (clockwise from east)
     */
    fogDirection: number;
    /**
     * (range: 0-100)
     */
    fogSpeed: number;
    /**
     * 32bit integer
     */
    fogFeatherTop: number;
    /**
     * 32bit integer
     */
    fogFeatherRight: number;
    /**
     * 32bit integer
     */
    fogFeatherBottom: number;
    /**
     * 32bit integer
     */
    fogFeatherLeft: number;
    /**
     * 32bit integer
     */
    fogMarginTop: number;
    /**
     * 32bit integer
     */
    fogMarginRight: number;
    /**
     * 32bit integer
     */
    fogMarginBottom: number;
    /**
     * 32bit integer
     */
    fogMarginLeft: number;
    /**
     * 32bit integer
     */
    fogSmoothing: number;
    distortion: ProtoGen.ZoneDistortion;
    /**
     * (range: 0-100)
     */
    distortionStrength: number;
    /**
     * (range: 0-100)
     */
    distortionScale: number;
    /**
     * (range: 0-100)
     */
    distortionSpeed: number;
    /**
     * 32bit integer
     */
    distortionFeatherTop: number;
    /**
     * 32bit integer
     */
    distortionFeatherRight: number;
    /**
     * 32bit integer
     */
    distortionFeatherBottom: number;
    /**
     * 32bit integer
     */
    distortionFeatherLeft: number;
    /**
     * 32bit integer
     */
    distortionMarginTop: number;
    /**
     * 32bit integer
     */
    distortionMarginRight: number;
    /**
     * 32bit integer
     */
    distortionMarginBottom: number;
    /**
     * 32bit integer
     */
    distortionMarginLeft: number;
    /**
     * 32bit integer
     */
    distortionSmoothing: number;

    //#endregion

    constructor(zone: CleanProtoMessage<ProtoGen.ProtoZone> | IZone) {
        this.id = zone.id;
        this.name = zone.name;
        this.priority = zone.priority;
        this.hue = zone.hue;
        this.width = zone.width;
        this.height = zone.height;
        this.membershipRle = zone.membershipRle instanceof ZoneMembership
            ? zone.membershipRle
            : new ZoneMembership(zone.width, zone.height, zone.membershipRle as ProtoGen.ProtoZone["membershipRle"]); // idk why this one is weird requiring casting
        this.vision = zone.vision;
        this.visionOutside = zone.visionOutside;
        this.hasVisionColor = zone.hasVisionColor;
        this.visionColor = zone.visionColor;
        this.cameraModeX = zone.cameraModeX;
        this.cameraModeY = zone.cameraModeY;
        this.cameraTarget = zone.cameraTarget;
        this.cameraMovement = zone.cameraMovement;
        this.cameraFollowMovement = zone.cameraFollowMovement;
        this.lighting = zone.lighting;
        this.lightDarkness = zone.lightDarkness;
        this.lightHue = zone.lightHue;
        this.lightTint = zone.lightTint;
        this.lightFeatherTop = zone.lightFeatherTop;
        this.lightFeatherRight = zone.lightFeatherRight;
        this.lightFeatherBottom = zone.lightFeatherBottom;
        this.lightFeatherLeft = zone.lightFeatherLeft;
        this.lightMarginTop = zone.lightMarginTop;
        this.lightMarginRight = zone.lightMarginRight;
        this.lightMarginBottom = zone.lightMarginBottom;
        this.lightMarginLeft = zone.lightMarginLeft;
        this.lightSmoothing = zone.lightSmoothing;
        this.playerLight = zone.playerLight;
        this.playerLightRadius = zone.playerLightRadius;
        this.playerLightStrength = zone.playerLightStrength;
        this.playerLightHue = zone.playerLightHue;
        this.playerLightSaturation = zone.playerLightSaturation;
        this.fog = zone.fog;
        this.fogHue = zone.fogHue;
        this.fogSaturation = zone.fogSaturation;
        this.fogOpacity = zone.fogOpacity;
        this.fogDensity = zone.fogDensity;
        this.fogDirection = zone.fogDirection;
        this.fogSpeed = zone.fogSpeed;
        this.fogFeatherTop = zone.fogFeatherTop;
        this.fogFeatherRight = zone.fogFeatherRight;
        this.fogFeatherBottom = zone.fogFeatherBottom;
        this.fogFeatherLeft = zone.fogFeatherLeft;
        this.fogMarginTop = zone.fogMarginTop;
        this.fogMarginRight = zone.fogMarginRight;
        this.fogMarginBottom = zone.fogMarginBottom;
        this.fogMarginLeft = zone.fogMarginLeft;
        this.fogSmoothing = zone.fogSmoothing;
        this.distortion = zone.distortion;
        this.distortionStrength = zone.distortionStrength;
        this.distortionScale = zone.distortionScale;
        this.distortionSpeed = zone.distortionSpeed;
        this.distortionFeatherTop = zone.distortionFeatherTop;
        this.distortionFeatherRight = zone.distortionFeatherRight;
        this.distortionFeatherBottom = zone.distortionFeatherBottom;
        this.distortionFeatherLeft = zone.distortionFeatherLeft;
        this.distortionMarginTop = zone.distortionMarginTop;
        this.distortionMarginRight = zone.distortionMarginRight;
        this.distortionMarginBottom = zone.distortionMarginBottom;
        this.distortionMarginLeft = zone.distortionMarginLeft;
        this.distortionSmoothing = zone.distortionSmoothing;
    }

    /**
     * This can be used to clone from.
     * 
     * NOTE: What this returns is meant to be pass through for the
     * upserting zone changes packet.
     * 
     * NOTE: One of the property is a binary type (membershipRle) which is not json friendly.
     * Encode/decode it yourself if you wish to stringify.
     */
    toJSON() : Omit<IZone, "membershipRle"> & { membershipRle: Uint8Array } {
        const res:Omit<IZone, "membershipRle"> & { membershipRle: Uint8Array } = {
            id: this.id,
            name: this.name,
            priority: this.priority,
            hue: this.hue,
            width: this.width,
            height: this.height,
            membershipRle: this.membershipRle.bytes,
            vision: this.vision,
            visionOutside: this.visionOutside,
            hasVisionColor: this.hasVisionColor,
            visionColor: this.visionColor,
            cameraModeX: this.cameraModeX,
            cameraModeY: this.cameraModeY,
            cameraTarget: this.cameraTarget,
            cameraMovement: this.cameraMovement,
            cameraFollowMovement: this.cameraFollowMovement,
            lighting: this.lighting,
            lightDarkness: this.lightDarkness,
            lightHue: this.lightHue,
            lightTint: this.lightTint,
            lightFeatherTop: this.lightFeatherTop,
            lightFeatherRight: this.lightFeatherRight,
            lightFeatherBottom: this.lightFeatherBottom,
            lightFeatherLeft: this.lightFeatherLeft,
            lightMarginTop: this.lightMarginTop,
            lightMarginRight: this.lightMarginRight,
            lightMarginBottom: this.lightMarginBottom,
            lightMarginLeft: this.lightMarginLeft,
            lightSmoothing: this.lightSmoothing,
            playerLight: this.playerLight,
            playerLightRadius: this.playerLightRadius,
            playerLightStrength: this.playerLightStrength,
            playerLightHue: this.playerLightHue,
            playerLightSaturation: this.playerLightSaturation,
            fog: this.fog,
            fogHue: this.fogHue,
            fogSaturation: this.fogSaturation,
            fogOpacity: this.fogOpacity,
            fogDensity: this.fogDensity,
            fogDirection: this.fogDirection,
            fogSpeed: this.fogSpeed,
            fogFeatherTop: this.fogFeatherTop,
            fogFeatherRight: this.fogFeatherRight,
            fogFeatherBottom: this.fogFeatherBottom,
            fogFeatherLeft: this.fogFeatherLeft,
            fogMarginTop: this.fogMarginTop,
            fogMarginRight: this.fogMarginRight,
            fogMarginBottom: this.fogMarginBottom,
            fogMarginLeft: this.fogMarginLeft,
            fogSmoothing: this.fogSmoothing,
            distortion: this.distortion,
            distortionStrength: this.distortionStrength,
            distortionScale: this.distortionScale,
            distortionSpeed: this.distortionSpeed,
            distortionFeatherTop: this.distortionFeatherTop,
            distortionFeatherRight: this.distortionFeatherRight,
            distortionFeatherBottom: this.distortionFeatherBottom,
            distortionFeatherLeft: this.distortionFeatherLeft,
            distortionMarginTop: this.distortionMarginTop,
            distortionMarginRight: this.distortionMarginRight,
            distortionMarginBottom: this.distortionMarginBottom,
            distortionMarginLeft: this.distortionMarginLeft,
            distortionSmoothing: this.distortionSmoothing
        };

        return res;
    }

    toPacket() : ISendablePacket<"worldZoneUpsertRequestPacket"> {
        return Zone.toPacket(this);
        // return {
        //     type: "worldZoneUpsertRequestPacket",
        //     packet: {
        //         zone: this.toJSON()
        //     }
        // }
    }

    static toPacket(zone: IZone | Zone) : ISendablePacket<"worldZoneUpsertRequestPacket"> {
        return {
            type: "worldZoneUpsertRequestPacket",
            packet: {
                zone: zone instanceof Zone ? zone.toJSON() : new Zone(zone).toJSON()
            }
        }
    }
    
    compareTo(b: IZone) {
        return compareObjs(this.toJSON(), b);
                // && compareObjs(this.args, b.args)
    }
}