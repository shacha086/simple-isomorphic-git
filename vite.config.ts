import {defineConfig} from "vite";
import dts from "vite-plugin-dts";
export default defineConfig({
    plugins: [
        dts({
            insertTypesEntry: true,
            tsConfigFilePath: "./tsconfig.json"
        })
    ],
    build: {
        lib: {
            entry: 'src/main.ts',
            name: 'simple-isomorphic-git',
            fileName: (format) => `index.${format}.js`,
            formats: ['es', 'cjs']
        }
    }
})