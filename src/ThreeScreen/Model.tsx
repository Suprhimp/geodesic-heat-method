import { useEffect, useRef } from 'react';
import { Mesh } from '../GeometryCore/mesh';
import { DenseMatrix } from '../LinearAlgebra/dense-matrix';
import { Vector } from '../LinearAlgebra/vector';
import { colormap, hot } from '../utils/colormap';
import * as THREE from 'three';
import { EigenModule } from '../Eigen/EigenModule';
import { HeatMethod } from '../HeatMethod';
import { Geometry } from '../GeometryCore/geometry';
import { Float32BufferAttribute } from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import { ThreeEvent, useLoader } from '@react-three/fiber';

// @ts-ignore
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { useGLTF } from '@react-three/drei';

const ORANGE = new Vector(1.0, 0.5, 0.0);
function getColors(phi?: DenseMatrix, mesh?: Mesh) {
  let maxPhi = 0.0;
  if (phi) {
    for (let i = 0; i < phi.nRows(); i++) {
      maxPhi = Math.max(phi.get(i, 0), maxPhi);
    }
  }

  let colors = [];

  for (let v of mesh!.vertices) {
    let i = v.index;

    let color;
    if (phi) {
      color = colormap(maxPhi - phi.get(i, 0), 0, maxPhi, hot);
      const ratio = phi.get(i, 0) / maxPhi;

      colors[3 * i + 0] = ratio;
      colors[3 * i + 1] = ratio;
      colors[3 * i + 2] = ratio;
    } else {
      color = ORANGE;
    }
  }
  return colors;
}

export const Model = () => {
  const { scene } = useGLTF('/test.glb');

  const calculateDistances = (object: THREE.Mesh, x: number) => {
    let i = object.userData['heatMethod'].vertexIndex[x];
    object.userData['delta'].set(1, i, 0);
    console.log(object.userData['delta'].get(i, 0));

    let phi =
      object.userData['delta'].sum() > 0 ? object.userData['heatMethod'].compute(object.userData['delta']) : undefined;
    object.userData['delta'].set(0, i, 0);

    const c = getColors(phi, object.userData['heatMethod'].geometry.mesh);
    object.geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(c), 3));
  };

  useEffect(() => {
    (async () => {
      await EigenModule.init();

      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          console.log(child.geometry);
          const g = BufferGeometryUtils.mergeVertices(child.geometry);
          child.material = new THREE.MeshBasicMaterial();
          child.material.side = 2;
          child.material.vertexColors = true;
          const m = new Mesh();
          const vertices = [];
          const positions = child.geometry.getAttribute('position');
          for (let i = 0; i < positions.count; i++) {
            vertices.push(new Vector(positions.getX(i), positions.getY(i), positions.getZ(i)));
          }
          console.log(child.geometry);
          const soup = {
            f: child.geometry.index?.array,
            v: vertices,
          };
          m.build(soup);
          const geometry = new Geometry(m, soup.v);
          let V = m.vertices.length;
          console.log(soup);

          child.userData['delta'] = DenseMatrix.zeros(V, 1);

          child.userData['heatMethod'] = new HeatMethod(geometry);
          calculateDistances(child, 0);
          child.geometry = g;
        }
      });
    })();
  }, []);
  return (
    <>
      <primitive
        object={scene}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.object instanceof THREE.Mesh) calculateDistances(e.object, e.face!.a);
        }}
      ></primitive>
      {/* <mesh ref={initMeshRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            name="position"
            args={[(model.children[0] as THREE.Mesh).geometry.attributes.position.array, 3]}
          />
          <bufferAttribute
            attach="attributes-normal"
            name="normal"
            args={[(model.children[0] as THREE.Mesh).geometry.attributes.normal.array, 3]}
          />
        </bufferGeometry>
        <meshPhongMaterial vertexColors />
      </mesh> */}
    </>
  );
};
