export interface OrbitalOptions {
    canvas: HTMLCanvasElement;
    target?: [number, number, number];
    distance?: number;
    theta?: number;
    phi?: number;
    minDistance?: number;
    maxDistance?: number;
    sensitivity?: number;
}

export class OrbitalControls {
    private canvas: HTMLCanvasElement;
    public target: [number, number, number];
    public distance: number;
    public theta: number;
    public phi: number;

    private minDistance: number;
    private maxDistance: number;
    private sensitivity: number;
    private isDragging: boolean = false;
    private lastX: number = 0;
    private lastY: number = 0;

    constructor(options: OrbitalOptions) {
        this.canvas = options.canvas;
        this.target = options.target || [0, 1.0, 0];
        this.distance = options.distance || 7;
        this.theta = options.theta || 0;
        this.phi = options.phi || 1.2;
        this.minDistance = options.minDistance || 2;
        this.maxDistance = options.maxDistance || 20;
        this.sensitivity = options.sensitivity || 0.01;

        this.initEvents();
    }

    private initEvents() {
        this.canvas.addEventListener('pointerdown', this.onPointerDown);
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        this.canvas.addEventListener('wheel', this.onWheel, { passive: true });
    }

    private onPointerDown = (e: PointerEvent) => {
        this.isDragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
    };

    private onPointerMove = (e: PointerEvent) => {
        if (!this.isDragging) return;
        const deltaX = e.clientX - this.lastX;
        const deltaY = e.clientY - this.lastY;

        this.lastX = e.clientX;
        this.lastY = e.clientY;

        this.theta -= deltaX * this.sensitivity;
        this.phi -= deltaY * this.sensitivity;

        // Prevent gimbal lock / flipping
        this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi));
    };

    private onPointerUp = () => { this.isDragging = false; };

    private onWheel = (e: WheelEvent) => {
        this.distance += e.deltaY * this.sensitivity;
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
    };

    /**
     * Call this in your render loop to get the new eye position
     */
    public getCameraPosition(): [number, number, number] {
        return [
            this.distance * Math.sin(this.phi) * Math.sin(this.theta) + this.target[0],
            this.distance * Math.cos(this.phi) + this.target[1],
            this.distance * Math.sin(this.phi) * Math.cos(this.theta) + this.target[2]
        ];
    }

    public destroy() {
        this.canvas.removeEventListener('pointerdown', this.onPointerDown);
        window.removeEventListener('pointermove', this.onPointerMove);
        window.removeEventListener('pointerup', this.onPointerUp);
        this.canvas.removeEventListener('wheel', this.onWheel);
    }
}