import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { 
    OrbitControls, 
    PerspectiveCamera, 
    ContactShadows, 
    Environment, 
    Float,
    Html,
    useTexture
} from '@react-three/drei';

interface BookModelProps {
    textureUrl: string;
    title: string;
}

const BookModel: React.FC<BookModelProps> = ({ textureUrl, title }) => {
    const texture = useTexture(textureUrl);
    
    // Adjust texture settings for better look
    texture.anisotropy = 16;
    // Handle both old and new Three.js color space constants
    if ('colorSpace' in texture) {
        (texture as any).colorSpace = 'srgb';
    } else {
        (texture as any).encoding = 3001; // sRGBEncoding
    }

    // Dynamic aspect ratio based on view type
    const isOpenView = title.toLowerCase().includes('open');
    const width = isOpenView ? 8 : 4;

    return (
        <Float
            speed={1.5} 
            rotationIntensity={0.5} 
            floatIntensity={0.5} 
        >
            <mesh castShadow receiveShadow>
                {/* 
                   Using ShaderMaterial to remove the grey background color 
                */}
                <planeGeometry args={[width, 5.5]} />
                <shaderMaterial
                    transparent={true}
                    side={2}
                    uniforms={{
                        uTexture: { value: texture }
                    }}
                    vertexShader={`
                        varying vec2 vUv;
                        void main() {
                            vUv = uv;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `}
                    fragmentShader={`
                        uniform sampler2D uTexture;
                        varying vec2 vUv;
                        void main() {
                            vec4 color = texture2D(uTexture, vUv);
                            // Detect if color is off-white/greyish (R,G,B are high and close to each other)
                            float brightness = (color.r + color.g + color.b) / 3.0;
                            float diff = abs(color.r - color.g) + abs(color.g - color.b);
                            
                            // If it's a very light grey/white background, discard it
                            if (brightness > 0.7 && diff < 0.1) {
                                discard;
                            }
                            
                            gl_FragColor = color;
                        }
                    `}
                />
            </mesh>
        </Float>
    );
};

interface Book3DPreviewProps {
    src: string;
    title: string;
}

const Book3DPreview: React.FC<Book3DPreviewProps> = ({ src, title }) => {
    return (
        <div className="w-full h-full cursor-grab active:cursor-grabbing">
            <Canvas shadows gl={{ antialias: true, preserveDrawingBuffer: true }}>
                <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={50} />
                
                <Suspense fallback={
                    <Html center>
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Loading 3D...</span>
                        </div>
                    </Html>
                }>
                    <ambientLight intensity={0.7} />
                    <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
                    <pointLight position={[-10, -10, -10]} intensity={0.5} />
                    
                    <BookModel textureUrl={src} title={title} />
                    
                    <ContactShadows 
                        position={[0, -3.5, 0]} 
                        opacity={0.4} 
                        scale={10} 
                        blur={2.5} 
                        far={4} 
                    />
                    
                    <Environment preset="city" />
                    
                    <OrbitControls 
                        enablePan={false}
                        minDistance={5}
                        maxDistance={15}
                        autoRotate={true}
                        autoRotateSpeed={0.5}
                    />
                </Suspense>
            </Canvas>
        </div>
    );
};

export default Book3DPreview;
