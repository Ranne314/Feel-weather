from flask import Flask, send_from_directory # run "bun run build" first and put index.html, global.css, and favicon.png in public

app = Flask(__name__)

@app.route('/')
def root():
    return send_from_directory('public', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('public', filename)

if __name__ == '__main__':
    app.run(debug=False)
