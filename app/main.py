import sys
import webbrowser
import json
import os
import ctypes
import pyrebase

# --- CONFIGURAZIONE FIREBASE (LA TUA) ---
firebaseConfig = {
    "apiKey": "AIzaSyC7Tbqt5FzJK8Z_USkCMWxXiHZp8uRN26A",
    "authDomain": "mattedev-account.firebaseapp.com",
    "projectId": "mattedev-account",
    "storageBucket": "mattedev-account.firebasestorage.app",
    "messagingSenderId": "77268069903",
    "appId": "1:77268069903:web:040aa6c3981eb3650afd7a",
    "databaseURL": "" # Lasciare vuoto se usi solo Firestore
}

# Inizializzazione
firebase = pyrebase.initialize_app(firebaseConfig)
db = firebase.database() # Nota: Pyrebase usa una sintassi leggermente diversa

def popup_errore(titolo, messaggio):
    ctypes.windll.user32.MessageBoxW(0, messaggio, titolo, 0x10)

def open_quill():
    # SE APERTA DA START
    if len(sys.argv) < 2:
        popup_errore("Quill Desktop", "Questa applicazione serve solo per aprire i file .quill.\n\nFai doppio click su un file .quill per iniziare.")
        return

    file_path = sys.argv[1]
    
    try:
        # CASO 1: FILE NUOVO (0 byte)
        if os.path.exists(file_path) and os.path.getsize(file_path) == 0:
            # Generiamo un ID univoco lato Python
            # Usiamo un metodo semplice per generare un ID compatibile con Firestore
            import uuid
            doc_id = str(uuid.uuid4()).replace("-", "")[:20] 
            
            # Scriviamo l'ID nel file locale immediatamente
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump({"docId": doc_id}, f)
            
            # Apriamo il browser passando l'ID e dicendo che è nuovo
            webbrowser.open(f"https://quill.mattedev.com/pages/editor.html?docId={doc_id}&action=new")
            return

        # CASO 2: FILE ESISTENTE
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            doc_id = data.get('docId')
            
            if doc_id:
                webbrowser.open(f"https://quill.mattedev.com/pages/editor.html?docId={doc_id}")
            else:
                popup_errore("Errore File", "ID documento non trovato nel file.")

    except Exception as e:
        popup_errore("Errore", f"Impossibile leggere il file: {str(e)}")

if __name__ == "__main__":
    open_quill()