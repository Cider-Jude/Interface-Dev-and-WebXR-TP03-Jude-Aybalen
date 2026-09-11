AFRAME.registerComponent('fix-rotation', {
  schema: { speed: { type: 'number', default: 4 } },

  init: function () {
    this.el.addEventListener('body-loaded', () => {
            this.body = this.el.body; // cannon-es body, from dynamic-body

            // lock the rotation of the sphere or it will be very nauseous
            //this.body.angularFactor.set(0, 0, 0);
            this.body.fixedRotation = true;
            this.body.updateMassProperties();
    });
  }
});

AFRAME.registerComponent('vr-turn', {
  schema: { speed: { type: 'number', default: 90 } },
  init: function () {
    this.axis = [0, 0, 0, 0];
    this.el.addEventListener('axismove', (evt) => { this.axis = evt.detail.axis; });
  },
  tick: function (time, delta) {
    const x = this.axis[2] ?? 0;
    if (Math.abs(x) < 0.2) return;

    const cameraRig = this.el.parentEl; // maintenant #cameraRig, pas #rig
    const dt = delta / 1000;
    cameraRig.object3D.rotation.y -= x * THREE.MathUtils.degToRad(this.data.speed) * dt;
  }
});

AFRAME.registerComponent('vr-move', {
  schema: { speed: { type: 'number', default: 4 } },
  init: function () {
    this.axis = [0, 0];
    this.el.addEventListener('axismove', (evt) => { this.axis = evt.detail.axis; });

    // Ligne de debug temporaire — this.el.addEventListener('axismove', (e) => console.log('axismove', e.detail.axis));

    const rig = this.el.parentEl.parentEl; // #rig, via #cameraRig;
    rig.addEventListener('body-loaded', () => {
      this.body = rig.body;
      this.body.fixedRotation = true;
      this.body.angularFactor.set(0, 0, 0); // gardez cette ligne aussi, pas seulement fixedRotation
      this.body.updateMassProperties();
    });
  },


  tick: function () {
    const rig = this.el.parentEl.parentEl;
    const body = rig.body;
    if (!body) return;

    // Quest/Oculus Touch: axis[2] = stick X, axis[3] = stick Y
    let x = this.axis[2] ?? 0;
    let y = this.axis[3] ?? 0;
    const deadzone = 0.15;
    if (Math.abs(x) < deadzone) x = 0;
    if (Math.abs(y) < deadzone) y = 0;

    const camera = rig.querySelector('[camera]');
    if (!camera) return;

    const forward = new THREE.Vector3();
    camera.object3D.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(forward.z, 0, +forward.x);

    const speed = this.data.speed;
    // y négatif = stick poussé vers l'avant sur la plupart des manettes
    const moveX = (right.x * x + forward.x * y) * speed;
    const moveZ = (right.z * x + forward.z * y) * speed;

    body.velocity.x = moveX;
    body.velocity.z = moveZ;
  }
});