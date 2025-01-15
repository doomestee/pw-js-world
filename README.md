# pw-js-world

This is a helper for the main library [PW-JS-Api](https://www.npmjs.com/package/pw-js-api) (since v0.2.1).

## Installation

To install this dependency, you must install PW-JS-Api first before installing this helper.

NPM:
```bash
npm i pw-js-api pw-js-world
```

PNPM:
```bash
pnpm i pw-js-api pw-js-world
```

Yarn:
```bash
yarn add pw-js-api pw-js-world
```

Bun:
```bash
bun i pw-js-api pw-js-world
```

## Usage

The code below shows an example, it does not do anything but you will get an idea on what you're expected to do before being able to use this.

```ts
import { BlockNames, PWApiClient } from "pw-js-api";
import { PWGameWorldHelper } from "pw-js-world";

const api = new PWApiClient(<YOUR_EMAIL>, <YOUR_PASSWORD>);
const helper = new PWGameWorldHelper();

await api.authenticate();

const con = await api.joinWorld(<WORLD_ID>, {
    gameSettings: {
        handlePackets: ["PING", "INIT"]
    }
});

con
// This is important, you must add the hook as soon as you get the
// connection before it receives init event.
.addHook(helper.receiveHook)
.addCallback("playerInitPacket", (data, states) => {
    console.log("Logged in as " + states?.player?.username);
})
.addCallback("worldBlockPlacedPacket", (data, states) => {
    console.log("Prev Block Id: " + states?.oldBlocks[0].bId);
    console.log("Prev Block Args: " + states?.oldBlocks[0].args);
    console.log("New Block Id: " + states?.newBlocks[0].bId);
    console.log("New Block Args: " + states?.newBlocks[0].args);
});
```

Once you have added the hook, the states (second parameter) in some of the callbacks will have the variables populated, allowing you to get the player object directly without needing to do yourself.

They may be undefined if the events occur before the initialisation of helper (which can happen in the first two seconds since the bot joins).

Alternatively, you can export and use the helper directly yourself if you want.