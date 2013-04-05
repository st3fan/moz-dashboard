from bottle import route, run, template, static_file

@route('/<path:path>')
def callback(path):
    return static_file(path, root="./static")

run(host='0.0.0.0', port=8080, debug=True)
