import os
import re
import json
import logging
import pandas as pd
from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_data(url: str, path_save: str):
    """
    Fetch data from the given URL, process it, and save it as a CSV file.

    Args:
        url (str): The URL to fetch data from.
        path_save (str): The path to save the CSV file.
    """
    logging.info("Starting web driver service.")
    service = Service()
    driver = webdriver.Firefox(service=service)

    driver.get(url)
    
    WebDriverWait(driver, 30).until(
        EC.presence_of_element_located((By.ID, "body_resultados"))
    )

    html = driver.page_source
    
    logging.info("Searching for JSON data in the page source.")
    match = re.search(r'var json\s*=\s*(\{.*?\});', html, re.DOTALL)
    if match:
        json_str = match.group(1)
        data = json.loads(json_str)
        logging.info("JSON data successfully extracted.")
    else:
        logging.error("No JSON data found in the page source.")
        driver.quit()
        return

    logging.info("Creating DataFrame from the extracted data.")
    df_scrapper = pd.DataFrame(
        data=[list(r.values()) for r in data["resultados"]],
        columns=data["encabezado"] + ["ID Resultado"]
    )

    file_name_save = os.path.join(path_save, data['evento']["nombre"] + ".csv")

    logging.info(f"Saving DataFrame to CSV file: {file_name_save}")
    df_scrapper.to_csv(file_name_save, index=False, sep="|")

    driver.quit()
