import type { ProtoGen } from "pw-js-api";//"../node_modules/pw-js-api/dist/gen/world_pb";

export interface KeyState {
    pressed: boolean  // Set true once during 'PlayerMovedPacket' packet in which event occurs
    released: boolean // Set true once during 'PlayerMovedPacket' packet in which event occurs
    held: boolean     // Set true for all 'PlayerMovedPacket' packets between pressed and released events
}

export interface KeyStates {
    up: KeyState
    down: KeyState
    left: KeyState
    right: KeyState
    jump: KeyState
}

function updateKeyState(keyState: KeyState, isPressed: boolean) {
    keyState.pressed = false
    keyState.released = false
    if (isPressed) {
        if (!keyState.held) {
            keyState.pressed = true
            keyState.held = true
        }
    } else {
        keyState.released = keyState.held
        keyState.held = false
    }
}

export function updateKeyStates(keyStates: KeyStates, data: ProtoGen.PlayerMovedPacket) {
    updateKeyState(keyStates.up, data.vertical < 0)
    updateKeyState(keyStates.down, data.vertical > 0)
    updateKeyState(keyStates.right, data.horizontal > 0)
    updateKeyState(keyStates.left, data.horizontal < 0)
    updateKeyState(keyStates.jump, data.spaceDown)
}