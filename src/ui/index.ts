import { UIState, DemoId } from "../types";
import { initEngineControls } from "./EngineControls";
import { initNavigation } from "./Navigation";

export function initUI(
    onStateChange: (state: UIState) => void,
    onDemoChange: (demoId: DemoId) => void
) {
    // 1. Initialize Sub-modules
    const controls = initEngineControls(onStateChange);

    // Pass a wrapper to Navigation so when it triggers onDemoChange,
    // the rest of the UI automatically syncs.
    const navigation = initNavigation((demoId) => {
        onDemoChange(demoId);
        controls.updateVisibility(demoId);
        navigation.updateInfoPanel(demoId);
    });

    return {

        // Expose sync function for initial load
        syncUI: (demoId: DemoId) => {
            navigation.highlightActiveItem(demoId);
            navigation.updateInfoPanel(demoId);
            controls.updateVisibility(demoId);
        }
    };
}