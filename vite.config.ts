import {defineConfig} from "vite";
export default defineConfig({
    build: {
        lib: {
            entry: 'src/main.ts',
            name: 'simple-isomorphic-git',
            fileName: (format) => `simple-isomorphic-git.${format}.js`,
            formats: ['es', 'cjs', 'umd']
        }
    }
})