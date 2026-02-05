import type { BlockArg, Point, SendableBlockPacket } from "./types/index.js";
import { LayerType } from "./Constants.js";
import { AnyBlockField, OmitRecursively, ProtoGen, PWApiClient, type BlockKeys, CleanProtoMessage, ISendablePacket, Optional } from "pw-js-api";
import { LegacyIncorrectArgError, LegacyIncorrectArgsLenError, MissingBlockError } from "./util/Error.js";
import { compareObjs, listedFieldTypeToGameType, map } from "./util/Misc.js";

/**
 * For Label.
 */
export enum TextAlignment {
    LEFT,
    CENTER,
    RIGHT
}

export interface ILabel {
    /**
     * ID of the label.
     * 
     * This may be undefined if you're creating this label.
     * Guaranteed to exist if given by the server.
     */
    id: string;
    /**
     * Whereabouts of this label.
     */
    position: Point;
    /**
     * Content of the label.
     */
    text: string;
    /**
     * Number of the colour.
     */
    color: number;
    /**
     * Maximum width of the text.
     */
    maxWidth: number;
    /**
     * Whether if this has shadow or not.
     */
    shadow: boolean;
    /**
     * Text's alignment.
     */
    textAlignment: TextAlignment;
    /**
     * Size of the font.
     */
    fontSize: number;
    /**
     * Spacing between each character (?)
     */
    characterSpacing: number;
    /**
     * Spacing between each line (?)
     */
    lineSpacing: number;
    /**
     * In which order this label goes on top of.
     */
    renderLayer: number;
    /**
     * Colour of the shadow.
     * 
     * Works if shadow is true.
     */
    shadowColor: number;
    /**
     * Offset (in X) of the shadow.
     * 
     * Works if shadow is true.
     */
    shadowOffsetX: number;
    /**
     * Offset (in Y) of the shadow.
     * 
     * Works if shadow is true.
     */
    shadowOffsetY: number;
}

export default class Label {
    /**
     * ID of the label.
     * 
     * This may be undefined if you're creating this label.
     * Guaranteed to exist if given by the server.
     */
    id: string;
    /**
     * Whereabouts of this label.
     */
    position: Point;
    /**
     * Content of the label.
     */
    text: string;
    /**
     * Number of the colour.
     */
    color: number;
    /**
     * Maximum width of the text.
     */
    maxWidth: number;
    /**
     * Whether if this has shadow or not.
     */
    shadow: boolean;
    /**
     * Text's alignment.
     */
    textAlignment: TextAlignment;
    /**
     * Size of the font.
     */
    fontSize: number;
    /**
     * Spacing between each character (?)
     */
    characterSpacing: number;
    /**
     * Spacing between each line (?)
     */
    lineSpacing: number;
    /**
     * In which order this label goes on top of.
     */
    renderLayer: number;
    /**
     * Colour of the shadow.
     * 
     * Works if shadow is true.
     */
    shadowColor: number;
    /**
     * Offset (in X) of the shadow.
     * 
     * Works if shadow is true.
     */
    shadowOffsetX: number;
    /**
     * Offset (in Y) of the shadow.
     * 
     * Works if shadow is true.
     */
    shadowOffsetY: number;

    constructor(label: CleanProtoMessage<ProtoGen.ProtoTextLabel> | ILabel) {
        this.id = label.id;
        if (label.position) {
            this.position = {
                x: label.position.x,
                y: label.position.y
            }
        }
        else this.position = { x: 0, y: 0 };
        this.text = label.text;
        this.color = label.color;
        this.maxWidth = label.maxWidth;
        this.shadow = label.shadow;
        this.textAlignment = label.textAlignment;
        this.fontSize = label.fontSize;
        this.characterSpacing = label.characterSpacing;
        this.lineSpacing = label.lineSpacing;
        this.renderLayer = label.renderLayer;
        this.shadowColor = label.shadowColor;
        this.shadowOffsetX = label.shadowOffsetX;
        this.shadowOffsetY = label.shadowOffsetY;
    }

    /**
     * This can be used to sort of clone from.
     */
    toJSON(newPos?: Optional<Point, "x"|"y"> | undefined) : ILabel {
        const res = {
            id: this.id,
            position: { x: this.position.x, y: this.position.y } as Point,
            text: this.text,
            color: this.color,
            maxWidth: this.maxWidth,
            shadow: this.shadow,
            textAlignment: this.textAlignment,
            fontSize: this.fontSize,
            characterSpacing: this.characterSpacing,
            lineSpacing: this.lineSpacing,
            renderLayer: this.renderLayer,
            shadowColor: this.shadowColor,
            shadowOffsetX: this.shadowOffsetX,
            shadowOffsetY: this.shadowOffsetY,
        };
        
        if (typeof newPos === "object") {
            if ("x" in newPos && newPos.x) res.position.x = newPos.x;
            if ("y" in newPos && newPos.y) res.position.y = newPos.y;
        }

        return res;
    }

    toPacket(newPos?: Optional<Point, "x"|"y">) : ISendablePacket<"worldLabelUpsertPacket"> {
        return {
            type: "worldLabelUpsertPacket",
            packet: {
                label: this.toJSON(newPos)
            }
        }
    }

    static toPacket(label: ILabel) : ISendablePacket<"worldLabelUpsertPacket"> {
        return {
            type: "worldLabelUpsertPacket",
            packet: {
                label: label
            }
        }
    }
    
    compareTo(b: ILabel) {
        return compareObjs(this.toJSON(), b);
                // && compareObjs(this.args, b.args)
    }
}