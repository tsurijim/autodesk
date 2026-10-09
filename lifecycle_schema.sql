-- Diagnóstico por ciclo de vida (interfaz de 6 fases)
-- Ejecutar una sola vez en phpMyAdmin, sobre la base u166233566_ad_platform.

CREATE TABLE IF NOT EXISTS lifecycle_diagnoses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_name VARCHAR(255) NOT NULL,
  industry VARCHAR(100) NULL,
  org_size VARCHAR(50) NULL,
  contact_email VARCHAR(255) NULL,
  total_checks INT NOT NULL DEFAULT 0,
  maturity_score INT NOT NULL DEFAULT 0,
  roi_potential DECIMAL(12,2) NOT NULL DEFAULT 0,
  payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_org (organization_name),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Una fila por cada opción marcada en cada fase.
CREATE TABLE IF NOT EXISTS lifecycle_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  diagnosis_id INT NOT NULL,
  phase_key VARCHAR(30) NOT NULL,
  option_key VARCHAR(80) NOT NULL,
  CONSTRAINT fk_lifecycle_diagnosis FOREIGN KEY (diagnosis_id)
    REFERENCES lifecycle_diagnoses(id) ON DELETE CASCADE,
  INDEX idx_phase_option (phase_key, option_key),
  INDEX idx_diagnosis (diagnosis_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Usuarios por fase: cuántas personas generan información y cuántas solo la consultan.
-- Sirve para estimar el tipo de licencia necesaria por fase.
CREATE TABLE IF NOT EXISTS lifecycle_phase_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  diagnosis_id INT NOT NULL,
  phase_key VARCHAR(30) NOT NULL,
  creators INT NOT NULL DEFAULT 0,
  consumers INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_phase_users_diagnosis FOREIGN KEY (diagnosis_id)
    REFERENCES lifecycle_diagnoses(id) ON DELETE CASCADE,
  UNIQUE KEY uq_diagnosis_phase (diagnosis_id, phase_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ejemplos de consulta:
-- ¿Cuántas organizaciones marcaron "bim-workflow" en diseño?
-- SELECT COUNT(DISTINCT diagnosis_id) FROM lifecycle_answers WHERE phase_key='design' AND option_key='bim-workflow';
-- Último diagnóstico con su madurez:
-- SELECT id, organization_name, maturity_score, created_at FROM lifecycle_diagnoses ORDER BY id DESC LIMIT 10;
