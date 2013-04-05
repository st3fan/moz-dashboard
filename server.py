from bottle import route, run, template, static_file

@route('/static/<path:path>')
def callback(path):
    return static_file(path, root="./static")

@route('/<:re:.*>')
def index():
    return static_file("index.html", root="./static")

run(host='0.0.0.0', port=8080, debug=True)
