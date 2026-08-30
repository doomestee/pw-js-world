import { CleanProtoMessage, ISendablePacket, ProtoGen } from "pw-js-api";
import { compareObjs } from "./util/Misc.js";

// soon
// export interface IZoneMembership {

// }

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
    membershipRle: Uint8Array;//IZoneMembership[];

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
    membershipRle: ProtoGen.ProtoZone["membershipRle"];

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
        this.membershipRle = zone.membershipRle as IZone["membershipRle"]; // idk why this one was weird
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
     * This can be used to sort of clone from.
     */
    toJSON() : IZone {
        const res:IZone = {
            id: this.id,
            name: this.name,
            priority: this.priority,
            hue: this.hue,
            width: this.width,
            height: this.height,
            membershipRle: this.membershipRle,
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
        return {
            type: "worldZoneUpsertRequestPacket",
            packet: {
                zone: this.toJSON()
            }
        }
    }

    static toPacket(zone: IZone) : ISendablePacket<"worldZoneUpsertRequestPacket"> {
        return {
            type: "worldZoneUpsertRequestPacket",
            packet: {
                zone
            }
        }
    }
    
    compareTo(b: IZone) {
        return compareObjs(this.toJSON(), b);
                // && compareObjs(this.args, b.args)
    }
}