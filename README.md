# Semantic Crossword

## Demo
Available [HERE](http://212.47.248.93:8898) (may be down or unstable).

## Usage
0. Download, set up and run the [kit-lod16-knowledge-panel](https://github.com/n1try/kit-lod16-knowledge-panel) server (_backend-core_)
1. `git clone https://github.com/brili/semantic-crossword.git`
2. Change `RANKING_ENDPOINT` constant in `generator.js` to use local ranking service (by default at `http://localhost:8080/api/ranking`)
3. `npm install`
4. `node index.js`