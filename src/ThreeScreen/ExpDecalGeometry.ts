import { BufferGeometry, Vector3, Matrix4, Float32BufferAttribute, Euler } from 'three';

/**
 * You can use this geometry to create a decal mesh, that serves different kinds of purposes.
 * e.g. adding unique details to models, performing dynamic visual environmental changes or covering seams.
 *
 * Constructor parameter:
 *
 * mesh — Any mesh object
 * position — Position of the decal projector
 * orientation — Orientation of the decal projector
 *
 * reference: http://blog.wolfire.com/2009/06/how-to-project-decals/
 *
 */

class ExpDecalGeometry extends BufferGeometry {
  constructor(mesh: THREE.Mesh, position: Vector3, orientation: Euler) {
    super(); // buffers

    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = []; // helpers

    const plane = new Vector3(); // this matrix represents the transformation of the decal projector

    const projectorMatrix = new Matrix4();
    projectorMatrix.makeRotationFromEuler(orientation);
    projectorMatrix.setPosition(position);
    const projectorMatrixInverse = new Matrix4();
    projectorMatrixInverse.copy(projectorMatrix).invert(); // generate buffers

    generate(); // build geometry

    this.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    this.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    this.setAttribute('uv', new Float32BufferAttribute(uvs, 2));

    function generate() {
      let i;
      let decalVertices: DecalVertex[] = [];
      const vertex = new Vector3();
      const normal = new Vector3(); // handle different geometry types

      const geometry = mesh.geometry;
      const positionAttribute = geometry.attributes.position;
      const normalAttribute = geometry.attributes.normal; // first, create an array of 'DecalVertex' objects
      // three consecutive 'DecalVertex' objects represent a single face
      //
      // this data structure will be later used to perform the clipping

      if (geometry.index !== null) {
        // indexed BufferGeometry
        const index = geometry.index;

        for (i = 0; i < index.count; i++) {
          vertex.fromBufferAttribute(positionAttribute, index.getX(i));
          normal.fromBufferAttribute(normalAttribute, index.getX(i));
          pushDecalVertex(decalVertices, vertex, normal);
        }
      } else {
        // non-indexed BufferGeometry
        for (i = 0; i < positionAttribute.count; i++) {
          vertex.fromBufferAttribute(positionAttribute, i);
          normal.fromBufferAttribute(normalAttribute, i);
          pushDecalVertex(decalVertices, vertex, normal);
        }
      } // second, clip the geometry so that it doesn't extend out from the projector

      // decalVertices = clipGeometry(decalVertices, plane.set(1, 0, 0));
      // decalVertices = clipGeometry(decalVertices, plane.set(-1, 0, 0));
      // decalVertices = clipGeometry(decalVertices, plane.set(0, 1, 0));
      // decalVertices = clipGeometry(decalVertices, plane.set(0, -1, 0));
      // decalVertices = clipGeometry(decalVertices, plane.set(0, 0, 1));
      // decalVertices = clipGeometry(decalVertices, plane.set(0, 0, -1)); // third, generate final vertices, normals and uvs

      for (i = 0; i < decalVertices.length; i++) {
        const decalVertex = decalVertices[i]; // create texture coordinates (we are still in projector space)

        // uvs.push(0.5 + decalVertex.position.x / size.x, 0.5 + decalVertex.position.y / size.y); // transform the vertex back to world space

        decalVertex.position.applyMatrix4(projectorMatrix); // now create vertex and normal buffer data

        vertices.push(decalVertex.position.x, decalVertex.position.y, decalVertex.position.z);
        normals.push(decalVertex.normal.x, decalVertex.normal.y, decalVertex.normal.z);
      }
    }

    function pushDecalVertex(decalVertices: DecalVertex[], vertex: Vector3, normal: Vector3) {
      // transform the vertex to world space, then to projector space
      vertex.applyMatrix4(mesh.matrixWorld);
      vertex.applyMatrix4(projectorMatrixInverse);
      normal.transformDirection(mesh.matrixWorld);
      decalVertices.push(new DecalVertex(vertex.clone(), normal.clone()));
    }

    function clipGeometry(inVertices: DecalVertex[], plane: Vector3) {
      const outVertices: DecalVertex[] = [];
      const s = 0.5; // a single iteration clips one face,
      // which consists of three consecutive 'DecalVertex' objects

      for (let i = 0; i < inVertices.length; i += 3) {
        let v1Out,
          v2Out,
          v3Out,
          total = 0;
        let nV1: DecalVertex, nV2: DecalVertex, nV3: DecalVertex, nV4: DecalVertex;
        const d1 = inVertices[i + 0].position.dot(plane) - s;
        const d2 = inVertices[i + 1].position.dot(plane) - s;
        const d3 = inVertices[i + 2].position.dot(plane) - s;
        v1Out = d1 > 0;
        v2Out = d2 > 0;
        v3Out = d3 > 0; // calculate, how many vertices of the face lie outside of the clipping plane

        total = (v1Out ? 1 : 0) + (v2Out ? 1 : 0) + (v3Out ? 1 : 0);

        switch (total) {
          case 0: {
            // the entire face lies inside of the plane, no clipping needed
            outVertices.push(inVertices[i]);
            outVertices.push(inVertices[i + 1]);
            outVertices.push(inVertices[i + 2]);
            break;
          }

          case 1: {
            // one vertex lies outside of the plane, perform clipping
            if (v1Out) {
              nV1 = inVertices[i + 1];
              nV2 = inVertices[i + 2];
              nV3 = clip(inVertices[i], nV1, plane, s);
              nV4 = clip(inVertices[i], nV2, plane, s);
              outVertices.push(nV1.clone());
              outVertices.push(nV2.clone());
              outVertices.push(nV3);
              outVertices.push(nV4);
              outVertices.push(nV3.clone());
              outVertices.push(nV2.clone());
            }

            if (v2Out) {
              nV1 = inVertices[i];
              nV2 = inVertices[i + 2];
              nV3 = clip(inVertices[i + 1], nV1, plane, s);
              nV4 = clip(inVertices[i + 1], nV2, plane, s);
              outVertices.push(nV3);
              outVertices.push(nV2.clone());
              outVertices.push(nV1.clone());
              outVertices.push(nV2.clone());
              outVertices.push(nV3.clone());
              outVertices.push(nV4);
              break;
            }

            if (v3Out) {
              nV1 = inVertices[i];
              nV2 = inVertices[i + 1];
              nV3 = clip(inVertices[i + 2], nV1, plane, s);
              nV4 = clip(inVertices[i + 2], nV2, plane, s);
              outVertices.push(nV1.clone());
              outVertices.push(nV2.clone());
              outVertices.push(nV3);
              outVertices.push(nV4);
              outVertices.push(nV3.clone());
              outVertices.push(nV2.clone());
            }

            break;
          }

          case 2: {
            // two vertices lies outside of the plane, perform clipping
            if (!v1Out) {
              nV1 = inVertices[i].clone();
              nV2 = clip(nV1, inVertices[i + 1], plane, s);
              nV3 = clip(nV1, inVertices[i + 2], plane, s);
              outVertices.push(nV1);
              outVertices.push(nV2);
              outVertices.push(nV3);
            }

            if (!v2Out) {
              nV1 = inVertices[i + 1].clone();
              nV2 = clip(nV1, inVertices[i + 2], plane, s);
              nV3 = clip(nV1, inVertices[i], plane, s);
              outVertices.push(nV1);
              outVertices.push(nV2);
              outVertices.push(nV3);
            }

            if (!v3Out) {
              nV1 = inVertices[i + 2].clone();
              nV2 = clip(nV1, inVertices[i], plane, s);
              nV3 = clip(nV1, inVertices[i + 1], plane, s);
              outVertices.push(nV1);
              outVertices.push(nV2);
              outVertices.push(nV3);
            }

            break;
          }
        }
      }

      return outVertices;
    }

    function clip(v0: DecalVertex, v1: DecalVertex, p: Vector3, s: number) {
      const d0 = v0.position.dot(p) - s;
      const d1 = v1.position.dot(p) - s;
      const s0 = d0 / (d0 - d1);
      const v = new DecalVertex(
        new Vector3(
          v0.position.x + s0 * (v1.position.x - v0.position.x),
          v0.position.y + s0 * (v1.position.y - v0.position.y),
          v0.position.z + s0 * (v1.position.z - v0.position.z)
        ),
        new Vector3(
          v0.normal.x + s0 * (v1.normal.x - v0.normal.x),
          v0.normal.y + s0 * (v1.normal.y - v0.normal.y),
          v0.normal.z + s0 * (v1.normal.z - v0.normal.z)
        )
      ); // need to clip more values (texture coordinates)? do it this way:
      // intersectpoint.value = a.value + s * ( b.value - a.value );

      return v;
    }
  }
} // helper

class DecalVertex {
  position: Vector3;
  normal: Vector3;

  constructor(position: Vector3, normal: Vector3) {
    this.position = position;
    this.normal = normal;
  }

  clone() {
    return new DecalVertex(this.position.clone(), this.normal.clone());
  }
}

export { ExpDecalGeometry, DecalVertex };