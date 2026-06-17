import os
from flask import Flask, send_from_directory

app = Flask(__name__, static_folder='static', template_folder='templates')


@app.route('/')
def index():
    return send_from_directory('templates', 'index.html')


@app.route('/survey/<path:rest>')
def survey_page(rest):
    return send_from_directory('templates', 'survey.html')


@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
