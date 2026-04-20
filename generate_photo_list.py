#!/usr/bin/env python3
"""
Script para generar la lista de fotos en formato JavaScript para el selector
"""

import os
import glob
import json

def generate_photo_list(photos_dir="images", output_file="photos_list.js"):
    """
    Genera un archivo JavaScript con la lista de todas las fotos

    Args:
        photos_dir: Directorio con las fotos en formato WebP
        output_file: Archivo de salida JavaScript
    """

    # Buscar todas las fotos WebP
    webp_files = sorted(glob.glob(os.path.join(photos_dir, "*.webp")))

    if not webp_files:
        print(f"No se encontraron archivos WebP en {photos_dir}")
        return

    print(f"Encontradas {len(webp_files)} fotos WebP")

    # Generar lista de fotos
    photos_list = []
    for webp_path in webp_files:
        filename = os.path.basename(webp_path)
        name_without_ext = os.path.splitext(filename)[0]

        photos_list.append({
            "name": name_without_ext,
            "path": f"{photos_dir}/{filename}",
            "filename": filename
        })

    # Generar código JavaScript
    js_code = f"""// Lista de fotos generada automáticamente
// Total de fotos: {len(photos_list)}
// Generado: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

const photos = {json.dumps(photos_list, indent=4, ensure_ascii=False)};

// Inicializar al cargar la página
window.addEventListener('DOMContentLoaded', function() {{
    console.log(`Cargadas ${{photos.length}} fotos`);
    renderGallery();
    updateStats();
}});
"""

    # Guardar archivo
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(js_code)

    print(f"\nArchivo generado: {output_file}")
    print(f"Total de fotos: {len(photos_list)}")
    print(f"\nAhora puedes abrir selector.html en el navegador")

if __name__ == "__main__":
    generate_photo_list()
