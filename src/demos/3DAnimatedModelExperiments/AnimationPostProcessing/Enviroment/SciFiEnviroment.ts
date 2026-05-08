import {Primitives, StandardLayout} from "null-graph/geometry";
import {buildPBRShader, StandardPBRMaterial} from "null-graph/materials";
import {Camera, NullGraph, RenderPassNode} from "null-graph";
import {setupFloor} from "./Floor";
import {setupButterfly} from "./butterflySetup";

export async function addSciFiEnvironment(engine:NullGraph, offscreenPass:RenderPassNode, camera:Camera) {

    const floor = await setupFloor(engine, offscreenPass);
    const butterfly = await setupButterfly(engine, offscreenPass, './3dAssets/butterfly.glb',camera);

    if(!butterfly || !floor){
        return ;
    }
    return {
        update: (simTime:number) => {
            floor.update(simTime);
            butterfly.update(simTime);
        },
        destroy: ():void => {
            floor.destroy();
            butterfly.destroy();
        }
    };
}