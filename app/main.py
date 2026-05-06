import sys
import webbrowser
import json
import os
import ctypes
import uuid

# --- CONFIGURAZIONE ---
BASE_URL = "https://quill.mattedev.com/pages/editor.html"

def popup_errore(titolo, messaggio):
    # MessageBoxW: 0x10 è l'icona di Errore (X bianca su cerchio rosso)
    ctypes.windll.user32.MessageBoxW(0, messaggio, titolo, 0x10)

def open_quill():
    # Verifica se è stato passato un file come argomento (doppio click)
    if len(sys.argv) < 2:
        popup_errore("Quill Desktop", "Trascina un file .quill qui sopra o fai doppio click su un file per aprirlo.")
        return

    file_path = sys.argv[1]
    
    try:
        # CASO 1: FILE NUOVO O VUOTO (Handshake Iniziale)
        if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
            # Generiamo un ID univoco (standard UUID4)
            doc_id = str(uuid.uuid4())
            
            # Scriviamo l'ID nel file locale per "legarlo" al cloud
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump({"docId": doc_id}, f)
            
            # Lanciamo il browser con action=new
            # JS su editor.html si occuperà di creare il record su Firestore dopo il login
            webbrowser.open(f"{BASE_URL}?docId={doc_id}&action=new")
            return

        # CASO 2: FILE ESISTENTE (Apertura normale)
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            doc_id = data.get('docId')
            
            if doc_id:
                webbrowser.open(f"{BASE_URL}?docId={doc_id}")
            else:
                popup_errore("Errore File", "Il file .quill è corrotto o non contiene un ID valido.")

    except Exception as e:
        popup_errore("Errore di Sistema", f"Impossibile processare il file:\n{str(e)}")

if __name__ == "__main__":
    open_quill()