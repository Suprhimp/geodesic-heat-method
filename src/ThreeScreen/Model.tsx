import { useEffect, useMemo, useRef, useState } from 'react';
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
function getColors(
  distanceList: number[],
  positionAttribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute
) {
  let maxPhi = 0.0;

  for (let i = 0; i < distanceList.length; i++) {
    maxPhi = Math.max(distanceList[i], maxPhi);
  }
  let colors = [];
  console.log(maxPhi);

  for (let i = 0; i < positionAttribute.count; i++) {
    let color;
    color = colormap(maxPhi - distanceList[i], 0, maxPhi, hot);
    const ratio = distanceList[i] / maxPhi;

    colors[3 * i + 0] = ratio;
    colors[3 * i + 1] = ratio;
    colors[3 * i + 2] = ratio;
  }
  return colors;
}

export const Model = () => {
  const { scene } = useGLTF('/bottle.glb');

  //   const geoCoreMesh = useMemo(() => new Mesh(), []);
  const [selectedMesh, setSelectedMesh] = useState<THREE.Mesh>(null!);

  const calcDist = (mesh: THREE.Mesh, point: THREE.Vector3) => {
    const vertex = new THREE.Vector3();
    const geometry = mesh.geometry;
    const positionAttribute = geometry.attributes.position;
    const normalAttribute = geometry.attributes.normal; // first, create an array of 'DecalVertex' objects
    let i;

    const distanceList: number[] = [];
    if (geometry.index !== null) {
      // indexed BufferGeometry
      const index = geometry.index;

      for (i = 0; i < index.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, index.getX(i));
        vertex.applyMatrix4(mesh.matrixWorld);
        distanceList.push(point.distanceTo(vertex));
      }
    } else {
      // non-indexed BufferGeometry
      for (i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, i);
        vertex.applyMatrix4(mesh.matrixWorld);
        distanceList.push(point.distanceTo(vertex));
      }
    }

    const c = getColors(distanceList, positionAttribute);
    mesh.geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(c), 3));
    console.log(mesh);
  };

  useEffect(() => {
    (async () => {
      await EigenModule.init();
      scene.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.material = new THREE.MeshBasicMaterial({ vertexColors: true });
          //   c.material.vertexColors = true;
        }
      });
    })();
  }, [scene]);

  return (
    <primitive
      object={scene}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.object instanceof THREE.Mesh) {
          setSelectedMesh(e.object);
          calcDist(e.object, e.point);
          //   calculateDistances(e.object, e.face!.a);
        }
      }}
    />
  );
};
