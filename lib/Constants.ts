export enum LayerType {
    Background,
    Foreground,
    Overlay
}

export enum EffectId {
    JumpHeight,
    Fly,
    Speed,
    Invulnerability,
    Curse,
    Zombie,
    Poison,
    GravityForce,
    MultiJump,
    /**
     * Left = 1, Up = 2, Right = 3.
     */
    GravityDirection
}
export const MAX_WORLD_BLOCK_PLACED_PACKET_POSITION_SIZE = 200;