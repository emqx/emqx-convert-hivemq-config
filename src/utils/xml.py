def get_text_from_element(element, tag):
    child = element.find(tag)
    if child is not None and child.text:
        return child.text.strip()
    return None
